# crawler/ (LEGACY)

本目录的 Python 爬虫已弃用（保留仅供历史参考，未来将移除）。

主路径是 Userscript（浏览器侧 GM XHR + Cookie Session），见：

- `app/static/backenduserscript/src/index.ts`

SSG/CI 产物生成使用 Node 脚本：

- `app/scripts/crawl-jwxt-static.ts`（`npm --prefix app run crawl:jwxt`）

## 产物目录（SSG 静态资源）

默认输出到：`app/static/crawler/data/`

- `app/static/crawler/data/current.json`
- `app/static/crawler/data/terms/<termId>--xkkz-<xkkzId>.json`

前端读取逻辑：`app/src/lib/data/catalog/cloudSnapshot.ts`

## CI/服务器侧运行（Node）

CI 中建议使用 `JWXT_COOKIE_HEADER`（来自已登录环境导出的 Cookie header）来绕过 SSO 变更；
也可使用 `JWXT_USERID/JWXT_PASSWORD`，但可能因校方策略/环境变化不稳定。
