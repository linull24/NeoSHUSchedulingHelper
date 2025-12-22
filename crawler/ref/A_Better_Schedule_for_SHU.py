import streamlit as st
import json
import re
import os
import sys
import subprocess
import base64
import time
import requests
from urllib.parse import urljoin

# =================配置区域=================
# 1. 默认文件路径
JSON_FILE_PATH = "schedule_2025_2.json"
BASE_URL = "https://jwxt.shu.edu.cn"  # 教务系统地址

# 2. 课程时间表配置
TIME_SLOTS = {
    # 上午
    1: ("08:00", "08:45"),
    2: ("08:55", "09:40"),
    3: ("10:00", "10:45"),
    4: ("10:55", "11:40"),
    # 下午 (从13:00开始)
    5: ("13:00", "13:45"),
    6: ("13:55", "14:40"),
    7: ("15:00", "15:45"),
    8: ("15:55", "16:40"),
    # 晚上 (从18:00开始)
    9: ("18:00", "18:45"),
    10: ("18:55", "19:40"),
    11: ("20:00", "20:45"),
    12: ("20:55", "21:40")
}

# 3. 配色池
COLOR_PALETTE = [
    ("#E3F2FD", "#1565C0", "#90CAF9"),  # 蓝
    ("#F3E5F5", "#7B1FA2", "#CE93D8"),  # 紫
    ("#E8F5E9", "#2E7D32", "#A5D6A7"),  # 绿
    ("#FFF3E0", "#EF6C00", "#FFCC80"),  # 橙
    ("#FCE4EC", "#C2185B", "#F48FB1"),  # 粉
    ("#E0F7FA", "#00838F", "#80DEEA"),  # 青
    ("#FFF8E1", "#F9A825", "#FFE082"),  # 黄
    ("#F1F8E9", "#558B2F", "#C5E1A5"),  # 浅绿
    ("#ECEFF1", "#455A64", "#B0BEC5"),  # 灰蓝
    ("#F9FBE7", "#9E9D24", "#E6EE9C"),  # 柠檬
]

# ================= 加密模块 (集成) =================

# 固定公钥
PUB_KEY_PEM = """-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDl/aCgRl9f/4ON9MewoVnV58OL
OU2ALBi2FKc5yIsfSpivKxe7A6FitJjHva3WpM7gvVOinMehp6if2UNIkbaN+plW
f5IwqEVxsNZpeixc4GsbY9dXEk3WtRjwGSyDLySzEESH/kpJVoxO7ijRYqU+2oSR
wTBNePOk1H+LRQokgQIDAQAB
-----END PUBLIC KEY-----"""


def encrypt_password(plain_pwd: str) -> str:
    """
    使用内置公钥加密密码。
    需要安装: pip install rsa
    """
    try:
        import rsa
    except ImportError:
        raise ImportError("缺少 'rsa' 库，无法进行密码加密。请在终端运行: pip install rsa")

    # 1. 加载公钥
    try:
        key = rsa.PublicKey.load_pkcs1_openssl_pem(PUB_KEY_PEM.encode())
    except Exception as e:
        raise ValueError(f"公钥加载失败: {e}")

    # 2. 使用公钥加密密码，结果为二进制
    cipher = rsa.encrypt(plain_pwd.encode(), key)

    # 3. 将二进制密文进行 Base64 编码并返回
    encoded = base64.b64encode(cipher).decode()
    return encoded


# ================= 核心类定义 =================

class LoginClient:
    def __init__(self, base_url: str, timeout: int = 10):
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.sess = requests.Session()
        self.sess.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        })

    def login(self, sid: str, password: str) -> dict:
        try:
            # 1. 尝试加密密码
            try:
                encrypted_pwd = encrypt_password(password)
            except ImportError as ie:
                return {"code": 997, "msg": str(ie)}
            except Exception as e:
                return {"code": 998, "msg": f"密码加密失败: {str(e)}"}

            # 2. SSO 登录 URL (注意：此URL包含timestamp等参数，长期可能失效)
            login_url = 'https://newsso.shu.edu.cn/login/eyJ0aW1lc3RhbXAiOjE3NDYyNDg4MDc3NTg2NjU5MDgsInJlc3BvbnNlVHlwZSI6ImNvZGUiLCJjbGllbnRJZCI6IkttNXQyMjVFOEtFQ0tRNlpEbTVLMlA2YVMyNDU5Q3VhIiwiY2xpZW50TmFtZSI6IuacrOenkeeUn-aVmeWKoeezu-e7nyIsInNjb3BlIjoianciLCJyZWRpcmVjdFVyaSI6Imh0dHBzOi8vand4dC5zaHUuZWR1LmNuL3Nzby9zaHVsb2dpbiIsInN0YXRlIjoiIiwiZG9tYWluIjoiIn0='

            data = {"username": sid, "password": encrypted_pwd}

            print(f"正在登录 SSO... 学号: {sid}")
            resp = self.sess.post(login_url, data=data, timeout=self.timeout)

            # 新版SSO成功后通常不直接返回"教学管理信息服务平台"，而是重定向或返回特定JSON
            # 这里沿用您提供的逻辑：检查页面内容
            if '教学管理信息服务平台' not in resp.text:
                # 简单的错误检查，实际情况可能需要解析JSON或HTML
                return {"code": 1002, "msg": "登录未通过，可能是用户名密码错误或接口变动"}

            # 3. 回跳验证
            resp3 = self.sess.get(self.base_url, timeout=self.timeout)
            if resp3.status_code != 200 or "统一认证" in resp3.text:
                return {"code": 1005, "msg": "SSO 回跳失败"}

            # 4. 激活会话
            timestamp = int(time.time() * 1000)
            init_menu_url = f"{self.base_url}/jwglxt/xtgl/index_initMenu.html?jsdm=xs&_t={timestamp}"
            resp4 = self.sess.get(init_menu_url, timeout=self.timeout)

            if resp4.status_code != 200:
                return {"code": 1007, "msg": "菜单初始化失败"}

            return {"code": 1000, "msg": "登录成功"}

        except requests.Timeout:
            return {"code": 1003, "msg": "网络请求超时"}
        except requests.RequestException as e:
            return {"code": 2333, "msg": f"网络请求异常: {str(e)}"}
        except Exception as e:
            return {"code": 999, "msg": f"未知错误：{str(e)}"}


class ScheduleExtractor:
    SCHEDULE_PATH = "jwglxt/xsxk/zzxkyzb_cxZzxkYzbChoosedDisplay.html"

    def __init__(self, session: requests.Session, base_url: str, timeout: int = 10):
        self.sess = session
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout

    def get_schedule(self, year: int, term: int, student_id: str) -> dict:
        schedule_url = urljoin(self.base_url, self.SCHEDULE_PATH)
        schedule_url_with_params = f"{schedule_url}?gnmkdm=N253512&su={student_id}"

        try:
            # 这里的 term_param 映射逻辑：1 -> 3 (秋季?), 2 -> 16 (春季?)
            # 请根据实际情况调整
            term_param = 3 if term == 1 else 16

            payload = {
                "xkxnm": str(year),
                "xkxqm": str(term_param),
            }

            headers = {
                "Referer": schedule_url_with_params,
                "Origin": self.base_url,
                "X-Requested-With": "XMLHttpRequest",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            }

            print(f"正在获取课表... {year}-{term}")
            response = self.sess.post(
                schedule_url_with_params,
                data=payload,
                headers=headers,
                timeout=self.timeout
            )

            if response.status_code != 200:
                return {"code": 2333, "msg": f"课表请求失败: {response.status_code}", "data": {}}

            if "用户登录" in response.text or "统一认证" in response.text:
                return {"code": 1006, "msg": "会话已过期，请重新登录", "data": {}}

            try:
                courses_data = response.json()
                if not courses_data:
                    return {"code": 1001, "msg": "该学期无课表数据", "data": {"courses": []}}

                courses = [self._parse_course(course) for course in courses_data]
                return {"code": 1000, "msg": "获取成功", "data": {"courses": courses}}

            except ValueError:
                return {"code": 2334, "msg": "响应格式非JSON", "data": {}}

        except Exception as e:
            return {"code": 999, "msg": f"未知异常：{str(e)}", "data": {}}

    def _parse_course(self, item: dict) -> dict:
        return {
            "course_id": item.get("kch") or item.get("kch_id"),
            "title": item.get("jxbmc") or item.get("kcmc"),
            "teacher": self._extract_teacher_name(item.get("jsxx", "")),
            "class_id": item.get("jxb_id"),
            "credit": self._to_float(item.get("xf")),
            "time": item.get("sksj", "").replace('<br/>', '\n'),
            "place": item.get("jxdd", "").replace('<br/>', '\n'),
            "raw_data": item
        }

    def _extract_teacher_name(self, teacher_info: str) -> str:
        if not teacher_info: return ""
        parts = teacher_info.split('/')
        if len(parts) >= 2: return parts[1]
        return teacher_info

    @staticmethod
    def _to_float(v):
        try:
            return float(v) if v is not None and v != '' else None
        except (ValueError, TypeError):
            return None


# ================= 辅助函数 =================

CN_TO_NUM = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7}


def get_color_for_course(course_title):
    if not course_title: return COLOR_PALETTE[0]
    hash_val = sum(ord(c) for c in course_title)
    return COLOR_PALETTE[hash_val % len(COLOR_PALETTE)]


def parse_time_segment(time_str, place_str, course_info):
    if not time_str: return []
    segments = time_str.split('\n')
    places = place_str.split('\n') if place_str else []
    parsed_results = []

    for i, seg in enumerate(segments):
        pattern = r"星期([一二三四五六日])第(\d+)-(\d+)节\{(.+?)\}"
        match = re.search(pattern, seg)
        if match:
            day_cn = match.group(1)
            start_node = int(match.group(2))
            end_node = int(match.group(3))
            week_raw = match.group(4)
            day_num = CN_TO_NUM.get(day_cn)

            weeks = []
            is_odd = '(单)' in week_raw
            is_even = '(双)' in week_raw
            clean_week_str = re.sub(r'周|\(单\)|\(双\)', '', week_raw)

            if ',' in clean_week_str:
                parts = clean_week_str.split(',')
                for p in parts:
                    if p.isdigit(): weeks.append(int(p))
            elif '-' in clean_week_str:
                try:
                    start, end = map(int, clean_week_str.split('-'))
                    for w in range(start, end + 1):
                        if is_odd and w % 2 == 0: continue
                        if is_even and w % 2 != 0: continue
                        weeks.append(w)
                except ValueError:
                    pass
            elif clean_week_str.isdigit():
                weeks.append(int(clean_week_str))

            specific_place = places[i] if i < len(places) else (places[0] if places else course_info.get('place', ''))
            specific_place = specific_place.replace('<br/>', ' ')

            parsed_results.append({
                'title': course_info.get('title', '未知课程').split('-')[0],
                'teacher': course_info.get('teacher', '未知教师'),
                'place': specific_place,
                'day': day_num,
                'start': start_node,
                'end': end_node,
                'weeks': weeks
            })
    return parsed_results


def generate_html_table(weekly_courses, current_week, for_export=False):
    schedule_map = {}
    for c in weekly_courses:
        for section in range(c['start'], c['end'] + 1):
            key = (section, c['day'])
            if key not in schedule_map: schedule_map[key] = []
            schedule_map[key].append(c)

    font_family = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    container_style = "width: 100%; padding: 20px;" if for_export else ""
    table_style = "width: 100%; border-collapse: collapse; table-layout: fixed;" if for_export else "width: 100%; border-collapse: separate; border-spacing: 4px; table-layout: fixed;"

    html_parts = []
    html_parts.append(f'<div style="{container_style} font-family: {font_family}; color: #333;">')

    if for_export:
        html_parts.append(f"""
        <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 24px;">第 {current_week} 周课程表</h1>
            <p style="margin: 5px 0; color: #666;">自动生成时间: 2025年秋季学期</p>
        </div>
        """)

    days_th = ''.join([
                          f'<th style="text-align: center; color: #444; font-weight: 600; font-size: 14px; border-bottom: 1px solid #eee;">{d}</th>'
                          for d in ['周一', '周二', '周三', '周四', '周五', '周六', '周日']])
    html_parts.append(f"""
    <table style="{table_style}">
        <thead>
            <tr style="height: 40px;">
                <th style="width: 80px; text-align: center; color: #888; font-weight: 500; font-size: 12px; border-bottom: 1px solid #eee;">时间</th>
                {days_th}
            </tr>
        </thead>
        <tbody>
    """)

    for section in range(1, 13):
        time_start, time_end = TIME_SLOTS.get(section, ("", ""))
        html_parts.append(f"""
        <tr style="height: 70px;">
            <td style="text-align: center; vertical-align: middle; border-right: 1px solid #eee; padding: 4px;">
                <div style="font-weight: bold; color: #444; font-size: 13px;">{section}</div>
                <div style="color: #999; font-size: 10px; margin-top: 2px;">{time_start}<br>{time_end}</div>
            </td>
        """)

        for day in range(1, 8):
            key = (section, day)
            courses = schedule_map.get(key, [])
            cell_content = ""
            is_start = False

            if courses:
                course = courses[0]
                is_start = (course['start'] == section)
                bg, text_color, border_color = get_color_for_course(course['title'])

                if is_start:
                    span = course['end'] - course['start'] + 1
                    height_css = f"height: calc({span}00% + {(span - 1) * 8}px);" if not for_export else f"height: {span * 70}px;"
                    z_index = 10
                    cell_content = f"""<div style="background-color: {bg}; color: {text_color}; border-left: 3px solid {border_color}; border-radius: 4px; padding: 6px; font-size: 12px; position: absolute; top: 0; left: 0; right: 0; {height_css} z-index: {z_index}; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin: 2px;">
                        <div style="font-weight: bold; margin-bottom: 2px; line-height: 1.3;">{course['title']}</div>
                        <div style="font-size: 11px; opacity: 0.85;">📍 {course['place']}</div>
                        <div style="font-size: 11px; opacity: 0.85;">👤 {course['teacher']}</div>
                    </div>"""

            position_style = "position: relative;" if is_start else ""
            border_style = "border-bottom: 1px solid #fafafa; border-right: 1px dashed #f5f5f5;"
            html_parts.append(
                f'<td style="{border_style} vertical-align: top; padding: 0; {position_style}">{cell_content}</td>')
        html_parts.append("</tr>")
    html_parts.append("</tbody></table></div>")

    full_html = "".join(html_parts)
    full_html = re.sub(r'^\s+', '', full_html, flags=re.MULTILINE)
    return full_html


# ================= 主程序逻辑 =================

def main():
    st.set_page_config(page_title="智能课表", layout="wide", page_icon="📅")

    # 状态初始化
    if 'schedule_data' not in st.session_state:
        st.session_state.schedule_data = None
    if 'source_name' not in st.session_state:
        st.session_state.source_name = ""

    # 侧边栏配置
    st.sidebar.title("⚙️ 课表设置")

    # 模式选择
    mode = st.sidebar.radio("数据来源", ["在线获取 (教务系统)", "本地文件 (JSON)"])

    data = None

    # ================= 模式 1: 在线获取 =================
    if mode == "在线获取 (教务系统)":
        st.sidebar.info("💡 请输入学号密码登录获取最新课表")

        with st.sidebar.form("login_form"):
            sid = st.text_input("学号")
            pwd = st.text_input("密码", type="password")

            col_y, col_t = st.columns(2)
            with col_y:
                year = st.number_input("学年", value=2025, step=1)
            with col_t:
                term = st.selectbox("学期", [1, 2], index=1, format_func=lambda x: f"第{x}学期")

            submit_login = st.form_submit_button("🚀 登录并获取", type="primary")

        if submit_login:
            if not sid or not pwd:
                st.sidebar.error("请输入学号和密码")
            else:
                client = LoginClient(BASE_URL)
                with st.spinner("正在登录教务系统..."):
                    login_res = client.login(sid, pwd)

                if login_res["code"] == 1000:
                    st.toast("✅ 登录成功！正在获取课表...")
                    extractor = ScheduleExtractor(client.sess, BASE_URL)

                    with st.spinner("正在解析课表数据..."):
                        # term 转换逻辑：前端选择 1/2，传给 extractor
                        schedule_res = extractor.get_schedule(year, term, sid)

                    if schedule_res["code"] == 1000:
                        st.session_state.schedule_data = schedule_res["data"]
                        st.session_state.source_name = f"在线数据 ({sid} - {year}学年)"
                        st.success("🎉 课表获取成功！")
                        st.rerun()
                    else:
                        st.sidebar.error(f"课表获取失败: {schedule_res['msg']}")
                else:
                    st.sidebar.error(f"登录失败: {login_res['msg']}")

    # ================= 模式 2: 本地文件 =================
    elif mode == "本地文件 (JSON)":
        if os.path.exists(JSON_FILE_PATH):
            if st.sidebar.button("📂 加载默认文件"):
                try:
                    with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f:
                        st.session_state.schedule_data = json.load(f)
                        st.session_state.source_name = os.path.basename(JSON_FILE_PATH)
                        st.rerun()
                except Exception as e:
                    st.sidebar.error(f"读取失败: {e}")

        uploaded_file = st.sidebar.file_uploader("或上传新的 JSON", type=["json"])
        if uploaded_file:
            try:
                st.session_state.schedule_data = json.load(uploaded_file)
                st.session_state.source_name = uploaded_file.name
            except Exception as e:
                st.sidebar.error(f"解析失败: {e}")

    # ================= 主界面显示 =================

    col_title, col_week, col_export = st.columns([3, 2, 2])

    with col_title:
        st.markdown("### 🏫 我的大学课表")
        source_display = st.session_state.source_name if st.session_state.schedule_data else "暂无数据"
        st.caption(f"当前数据: {source_display}")

    with col_week:
        current_week = st.number_input("📅 切换周次", min_value=1, max_value=16, value=1)

    # 数据处理与渲染
    data = st.session_state.schedule_data
    if data:
        all_courses_flat = []
        # 兼容两种数据结构: {"courses": [...]} 或 直接 [...]
        courses_list = data.get('courses', []) if isinstance(data, dict) else data

        for course in courses_list:
            parsed = parse_time_segment(course.get('time'), course.get('place'), course)
            all_courses_flat.extend(parsed)

        weekly_courses = [c for c in all_courses_flat if current_week in c['weeks']]

        # 渲染
        html_view = generate_html_table(weekly_courses, current_week, for_export=False)
        st.markdown(html_view, unsafe_allow_html=True)

        st.write("---")
        with col_export:
            # 导出按钮
            export_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>课表-第{current_week}周</title>
    <style>
        @media print {{
            @page {{ size: A4 landscape; margin: 10mm; }}
            body {{ -webkit-print-color-adjust: exact; }}
            .no-print {{ display: none; }}
        }}
        body {{ margin: 0; padding: 20px; font-family: "Inter", sans-serif; }}
        .print-hint {{ 
            text-align: center; margin-bottom: 20px; padding: 10px; 
            background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 4px;
            color: #0369a1; font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class="no-print print-hint">
        💡 提示：如果打印对话框未自动弹出，请按 <strong>Ctrl + P</strong> (Windows) 或 <strong>Cmd + P</strong> (Mac) 进行打印。
    </div>
    {generate_html_table(weekly_courses, current_week, for_export=True)}
    <script>
        window.onload = function() {{ setTimeout(function() {{ window.print(); }}, 500); }}
    </script>
</body>
</html>"""
            st.download_button(
                label="📥 下载课表 (HTML)",
                data=export_content,
                file_name=f"课表_第{current_week}周.html",
                mime="text/html"
            )

        st.caption(f"本周课程数: {len(weekly_courses)}")
    else:
        # 空状态提示
        st.info("👋 欢迎！请在左侧侧边栏选择 **在线获取** 或 **加载本地文件** 以查看课表。")
        st.markdown("""
        **功能说明：**
        1. **在线获取**: 输入学号密码，自动从教务系统抓取最新课表。
        2. **本地文件**: 支持加载标准的 JSON 格式课表数据。
        3. **导出**: 支持将当前周课表导出为 HTML (可打印为 PDF)。
        """)


if __name__ == "__main__":
    def run_streamlit():
        print("正在启动 Streamlit...")
        script_path = os.path.abspath(__file__)
        my_env = os.environ.copy()
        my_env["STREAMLIT_BROWSER_GATHER_USAGE_STATS"] = "false"
        subprocess.run([sys.executable, "-m", "streamlit", "run", script_path], env=my_env)


    try:
        from streamlit.runtime.scriptrunner import get_script_run_ctx

        if get_script_run_ctx():
            main()
        else:
            run_streamlit()
    except ImportError:
        try:
            if "streamlit" in sys.modules: run_streamlit()
        except:
            pass