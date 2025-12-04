import argparse
import asyncio
import base64
import getpass
import hashlib
import json
import os
import re
import ssl
import time
from urllib.parse import urlencode, parse_qs, urlparse

import aiohttp
import certifi
import rsa

JWXK_BACKEND = 'https://jwxk.shu.edu.cn'
OAUTH_URL = 'https://oauth.shu.edu.cn'
RSA_PUBKEY = '''-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDl/aCgRl9f/4ON9MewoVnV58OL
OU2ALBi2FKc5yIsfSpivKxe7A6FitJjHva3WpM7gvVOinMehp6if2UNIkbaN+plW
f5IwqEVxsNZpeixc4GsbY9dXEk3WtRjwGSyDLySzEESH/kpJVoxO7ijRYqU+2oSR
wTBNePOk1H+LRQokgQIDAQAB
-----END PUBLIC KEY-----'''
SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())


class JWXTCrawler:
    @staticmethod
    def __encrypt_password(password):
        key = rsa.PublicKey.load_pkcs1_openssl_pem(RSA_PUBKEY.encode())
        return base64.b64encode(rsa.encrypt(password.encode(), key)).decode()

    def __init__(self, username, password):
        self.__session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(ssl=False)
        )
        self.__username = username
        self.__password = password
        self.__token = None

    async def oauth_login(self):
        oauth_params = {
            'response_type': 'code',
            'client_id': 'E422OBk2611Y4bUEO21gm1OF1RxkFLQ6',
            'redirect_uri': 'https://jwxk.shu.edu.cn/xsxk/oauth/callback',
            'scope': '1'
        }
        
        r = await self.__session.get(
            f'{OAUTH_URL}/oauth/authorize?{urlencode(oauth_params)}',
            allow_redirects=False
        )
        print(f'Step 1 - OAuth authorize: status={r.status}')
        assert r.status == 302
        login_url = r.headers['Location']
        if not login_url.startswith('http'):
            login_url = f'{OAUTH_URL}{login_url}'
        print(f'Step 2 - Login URL: {login_url}')
        
        r = await self.__session.get(login_url)
        print(f'Step 3 - GET login_url: status={r.status}')
        await asyncio.sleep(0.3)
        
        print(f'Step 4 - POST login with username={self.__username}')
        r = await self.__session.post(
            login_url,
            data={
                'username': self.__username,
                'password': self.__encrypt_password(self.__password)
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            allow_redirects=False
        )
        print(f'Step 5 - Login POST: status={r.status}')
        if r.status != 302:
            text = await r.text()
            print(f'Login response: {text[:500]}')
        assert r.status == 302
        
        redirect_after_login = r.headers['Location']
        print(f'Step 5b - Redirect after login: {redirect_after_login}')
        
        # If redirected back to authorize, we need to follow it
        if '/oauth/authorize' in redirect_after_login:
            if not redirect_after_login.startswith('http'):
                redirect_after_login = f'{OAUTH_URL}{redirect_after_login}'
            print(f'Step 5c - Following authorize redirect: {redirect_after_login}')
            r = await self.__session.get(redirect_after_login, allow_redirects=False)
            print(f'Step 5d - Authorize response: status={r.status}')
            if r.status == 302:
                callback_url = r.headers['Location']
            else:
                callback_url = redirect_after_login
        else:
            callback_url = redirect_after_login
        if not callback_url.startswith('http'):
            callback_url = f'{OAUTH_URL}{callback_url}'
        print(f'Step 6 - Callback URL: {callback_url}')
        
        r = await self.__session.get(callback_url, allow_redirects=False)
        print(f'Step 7 - GET callback_url: status={r.status}')
        assert r.status == 302
        
        final_url = r.headers['Location']
        print(f'Step 8 - Final URL: {final_url}')
        # Extract code from callback URL
        parsed_url = urlparse(final_url)
        query_params = parse_qs(parsed_url.query)
        
        if 'code' in query_params:
            code = query_params['code'][0]
            print(f'Step 9 - Got code: {code[:20]}...')
            # Exchange code for token immediately
            r = await self.__session.post(
                f'{JWXK_BACKEND}/xsxk/oauth/token',
                data={
                    'code': code,
                    'client_id': 'E422OBk2611Y4bUEO21gm1OF1RxkFLQ6'
                },
                headers={'Content-Type': 'application/x-www-form-urlencoded'}
            )
            data = await r.json()
            print(f'Step 10 - Token exchange response: {data}')
            if data.get('code') == 200 and 'data' in data:
                self.__token = data['data'].get('token')
            else:
                raise ValueError(f'Failed to exchange code for token: {data}')
        elif 'token=' in final_url:
            self.__token = final_url.split('token=')[1]
        else:
            print(f'Error: neither token nor code found in final_url: {final_url}')
            raise ValueError(f'No token or code in redirect URL: {final_url}')
        
        print(f'OAuth login successful, token obtained')

    async def fetch_batches(self):
        r = await self.__session.post(
            f'{JWXK_BACKEND}/xsxk/web/studentInfo',
            data=f'token={self.__token}',
            headers={
                'Authorization': self.__token,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        )
        data = await r.json()
        assert data['code'] == 200
        
        batches = []
        seen_terms = set()
        for batch in data['data']['student']['electiveBatchList']:
            term = batch['schoolTerm']
            if term not in seen_terms:
                seen_terms.add(term)
                batches.append({
                    'schoolTerm': term,
                    'name': batch['name'],
                    'code': batch['code']
                })
        
        batches.sort(key=lambda x: int(x['schoolTerm'].split('-')[0]) * 10 + int(x['schoolTerm'].split('-')[2]), reverse=True)
        print(f'Found {len(batches)} terms')
        return batches

    async def fetch_courses(self, batch_code):
        await self.__session.get(
            f'{JWXK_BACKEND}/xsxk/elective/shu/grablessons?batchId={batch_code}',
            headers={'Cookie': f'Authorization={self.__token}'}
        )
        
        r = await self.__session.post(
            f'{JWXK_BACKEND}/xsxk/elective/shu/clazz/list',
            data='teachingClassType=ALLKC&pageNumber=1&pageSize=1',
            headers={
                'Authorization': self.__token,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        )
        data = await r.json()
        assert data['code'] == 200
        
        total = data['data']['list']['total']
        print(f'Total courses: {total}')
        
        r = await self.__session.post(
            f'{JWXK_BACKEND}/xsxk/elective/shu/clazz/list',
            data=f'teachingClassType=ALLKC&pageNumber=1&pageSize={total}',
            headers={
                'Authorization': self.__token,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        )
        data = await r.json()
        assert data['code'] == 200
        
        courses = []
        for course in data['data']['list']['rows']:
            limitations = []
            if course['noCheckKrl'] == '0' and course['KRL'] == course['YXRS']:
                limitations.append('人数已满')
            elif course['noCheckKrl'] == '0':
                limitations.append('限制人数')
            if course['canSelect'] == '0':
                limitations.append('禁止选课')
            if course['canDelete'] == '0':
                limitations.append('禁止退课')
            
            courses.append({
                'campus': course['XQ'],
                'capacity': str(course['KRL']),
                'classTime': course['YPSJDD'],
                'courseId': course['KCH'],
                'courseName': course['KCM'],
                'credit': course['XF'],
                'limitations': limitations,
                'number': str(course['YXRS2'] if course['noCheckKrl'] == '1' else course['YXRS']),
                'position': course.get('teachingPlaceHide', ''),
                'teacherId': course['KXH'],
                'teacherName': course.get('SKJS', ''),
                'teacherTitle': course['SKJSZC']
            })
        
        return courses

    async def crawl(self, output_dir):
        os.makedirs(output_dir, 0o755, True)
        os.makedirs(os.path.join(output_dir, 'terms'), 0o755, True)
        
        await self.oauth_login()
        batches = await self.fetch_batches()
        
        result = {}
        for batch in batches:
            print(f'Crawling term: {batch["name"]} ({batch["schoolTerm"]})')
            courses = await self.fetch_courses(batch['code'])
            
            data_hash = hashlib.md5(json.dumps(courses, sort_keys=True).encode()).hexdigest()
            result[batch['schoolTerm']] = {
                'backendOrigin': JWXK_BACKEND,
                'courses': courses,
                'hash': data_hash,
                'termName': batch['name'],
                'updateTimeMs': int(time.time() * 1000)
            }
            print(f'Fetched {len(courses)} courses ({data_hash})')
            await asyncio.sleep(0.5)
        
        for term_id, data in result.items():
            filepath = os.path.join(output_dir, 'terms', f'{term_id}.json')
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
            print(f'Saved: terms/{term_id}.json')
        
        current = sorted(result.keys(), reverse=True)
        with open(os.path.join(output_dir, 'current.json'), 'w', encoding='utf-8') as f:
            json.dump(current, f, ensure_ascii=False, indent=2)
        print('Saved: current.json')

    async def close(self):
        await self.__session.close()


async def main(output_dir, username, password):
    crawler = JWXTCrawler(username, password)
    try:
        await crawler.crawl(output_dir)
    finally:
        await crawler.close()
        print('Finished.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Crawl courses from jwxk.shu.edu.cn with OAuth.')
    parser.add_argument('-o', '--output-dir', default='data', help='Output directory')
    parser.add_argument('-u', '--username', required=True, help='Student ID')
    parser.add_argument('-p', '--password', help='Password')
    parser.add_argument('--password-stdin', action='store_true', help='Read password from stdin')
    
    args = parser.parse_args()
    
    if args.password:
        pwd = args.password
    elif args.password_stdin:
        pwd = input()
    else:
        pwd = getpass.getpass()
    
    asyncio.run(main(args.output_dir, args.username, pwd))
