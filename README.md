SHU JWXT Course Crawler
=======================

This repository now contains a fresh implementation of a crawler that can log
in to the新上海大学教务系统 (`https://jwxt.shu.edu.cn`) via the official SSO jump
and export the complete list of available教学班信息 for the current学期/选课轮次.

Usage
-----

Web App (SSG, GitHub Pages)
---------------------------

The `app/` directory contains a SvelteKit UI that builds as a fully static site and can be deployed to GitHub Pages (`https://<user>.github.io/<repo>/`).

- Enable GitHub Pages for the repository: Settings → Pages → Source: GitHub Actions.
- Push to `main`/`master` and wait for the `Deploy to GitHub Pages` workflow.

Local build:

    cd app
    npm install
    npm run build

All crawler assets now live in `crawler/`, managed by `uv` via
`crawler/pyproject.toml`.

1.  Prepare the environment (Python 3.10+):

        cd crawler
        uv venv .venv
        uv pip install -r pyproject.toml

2.  Run the crawler (either via the script entrypoint or directly):

        uv run jwxt-crawler -u <学号> -p <密码>
        # 或者
        uv run python jwxt_crawler.py -u <学号> -p <密码>

    Optional arguments:

    * `-o, --output-dir DIR` (default `data`) – target directory for JSON.
    * `--password-stdin` – read password from standard input without echo.

3.  Output structure after a successful run:

        crawler/data/
        ├── current.json          # 所有已导出的学期编号列表
        └── terms/
            └── 2025-16.json      # 某个学期的课程列表

Implementation Notes
--------------------

* The crawler mimics a browser:
  * 请求 `https://jwxt.shu.edu.cn/sso/shulogin`，自动跳转到 `newsso.shu.edu.cn`
    并使用 RSA 公钥加密密码后登录；
  * 再顺着 302 跳转回 `jwglxt`，生成有效的 `JSESSIONID`。
* 选课页面会根据当前帐号自动选择可用的学期/选课批次。脚本会读取页面里所有隐藏
  字段，避免硬编码 “春/秋/夏” 等常量，未来系统扩展时无需修改。
* 课程数据通过以下 AJAX 接口完成抓取：
  * `.../zzxkyzb_cxZzxkYzbPartDisplay.html` – 批量拉取课程（按教学班）；
  * `.../zzxkyzbjk_cxJxbWithKchZzxkYzb.html` – 单一课程的详细教学班信息。
* 所有课程最终规范化为统一 JSON 字段（课程号、课程名、教师、容量、时间、地点、
  限制信息等），并附带 `hash` 与 `updateTimeMs` 方便增量校验。

安全提示
--------

* 账号密码仅用于与学校官方服务器通信，脚本不会将信息写入仓库。
* 建议使用一次性环境变量或 `--password-stdin` 传递口令，避免留存明文。
* 请合理控制抓取频率，避免对学校服务器造成压力。
