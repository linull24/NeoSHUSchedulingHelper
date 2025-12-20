# NeoSHUCourseHelper

众所周知，2024年是艰难的一年。

一年之内，我们经历了三个选课系统的变化。

随着新选课系统的引入和学期改制，这是一个新版的前端纯静态的，同时允许后端部署的新选课助手。

功能:

* 从正方教务爬虫课程信息，导入，一键pull和push
* 对于单双周和上半下半学期的明显的ui逻辑
* SAT求解器使得可以处理复杂的连环调课问题
* github同步账户数据

致谢：

* 最初作品
  * [cosformula/CourseSchedulingHelper](https://github.com/cosformula/CourseSchedulingHelper) — @cosformula
  * [ZKLlab/SHU-scheduling-helper](https://github.com/ZKLlab/SHU-scheduling-helper) — @ZKLlab
  `xk.shuosc.com：
  * public contributors，截至 2025-12-19）：
    * @ZKLlab
    * @BH4HPA
    * @hidacow
    * @chinggg
    * @Sanstale
    * @panghaibin
* 爬虫参考（`crawler/ref/`）：
  * [shuosc/shu-course-data](https://github.com/shuosc/shu-course-data)
  * [Kunz1Pro/CUMT-jwxt](https://github.com/Kunz1Pro/CUMT-jwxt)
  * `crawler/ref/CCSU_course`（长沙学院抢课工具代码参考）
  * 鼠鼠选课plus @IAFEnvoy
* 感谢 @ceilf6 的 console 抢课脚本，为后端完善提供参考
* 感谢 @zichunHU 的第三方对于完善后段的参考
---

## 快速开始

### 部署 Web 应用（3 分钟）

1. **启用 GitHub Pages**

   - 项目设置 → Pages → Source: GitHub Actions
   - Push 到 `main` 分支，等待自动部署
2. **本地构建**

   ```bash
   cd app
   npm install
   npm run build
   ```

   构建输出放在 `app/build/`，可部署到任何静态服务器。

### 爬取课程数据（初次登录 < 1 分钟）

**前置要求**：Python 3.10+

```bash
cd crawler
uv venv .venv
source .venv/bin/activate  # macOS/Linux
# 或 .venv\Scripts\activate  # Windows

uv pip install -e .
```

**运行爬虫**：

```bash
# 首次登录（需要输入学号和密码）
uv run jwxt-crawler -u <学号> -p <密码>

# 使用加密 Cookie 免密刷新（第二次及以后）
uv run jwxt-crawler
```

**高级选项**：

| 选项                     | 说明                                         | 示例                                 |
| ------------------------ | -------------------------------------------- | ------------------------------------ |
| `-o, --output-dir`     | 课程数据输出目录（默认 `data`）            | `-o ~/my_courses`                  |
| `--password-stdin`     | 从标准输入读取密码（不回显）                 | 配合脚本使用                         |
| `--cookie-header`      | 跳过登录，直接使用已有 Cookie                | `--cookie-header "JSESSIONID=..."` |
| `--campus-scope`       | 校区范围（`all` \| `current` \| 具体值） | `--campus-scope all`               |
| `--clear-cookie-store` | 清除保存的 Cookie 和密钥                     | 需要重新登录时用                     |

**输出示例**：

```
crawler/data/
├── current.json          # 当前学期信息与轮次（termId, jwxtRound）
└── terms/
    └── 2025-16--xkkz-<id>.json   # 学期 2025-16、轮次 <id> 的课程列表
```

---

## 项目结构

```
.
├── app/                    # 前端选课应用（SvelteKit + Vite）
│   ├── src/               # 源代码（Svelte 组件、路由、类型）
│   ├── package.json       # Node.js 依赖
│   ├── build/             # 构建输出（静态 HTML/JS/CSS）
│   └── README.md          # 应用独立文档
│
├── crawler/               # Python 爬虫与数据处理
│   ├── jwxt_crawler.py    # 爬虫主程序
│   ├── pyproject.toml     # Python 依赖（uv 格式）
│   └── data/              # 课程 JSON 快照（构建时复制到前端）
│
├── scripts/               # 工具脚本
│   ├── check_i18n.py      # 国际化文案检查
│   ├── dev-smoke.sh       # 开发环境快速验证
│   └── ...
│
└── docs/                  # 开发文档（架构、状态机等）
    └── STATE.md           # 应用状态机与数据流说明
```

**忽略项**（`.gitignore` 中排除，不在版本控制内）：

- `agentTemps/` — 开发助手临时文件
- `openspec/` — 项目规划与 spec 文档
- `.secrets.*` — 本地 Cookie 与密钥（仅本机有效）
- `PLAN.md`, `AGENTS.md` — 开发计划文档

---

## 核心工作流程

### 1️⃣ 爬取课程（首次）

学生通过爬虫脚本登录教务系统，导出当前学期的课程列表。

```bash
cd crawler && uv run jwxt-crawler -u <学号> -p <密码>
```

**爬虫行为**：

- 请求教务系统 SSO，自动重定向到大学统一登录平台
- 使用 RSA 公钥加密密码，通过 Cookies 建立会话（`JSESSIONID`）
- 调用内部 AJAX 接口拉取所有教学班信息
- 将课程规范化为统一 JSON 格式，包含课号、课名、教师、时间、地点、容量、限制信息等

**输出**：`crawler/data/terms/<termId>.json` — 课程 JSON 列表

### 2️⃣ 配置数据源（可选）

若要让 Web 应用自动从远端拉取最新课程数据，在构建时设置环境变量：

```bash
export VITE_CRAWLER_CURRENT_URL="/crawler/data/current.json"
export VITE_CRAWLER_TERMS_BASE_URL="/crawler/data/terms/"

cd app && npm run build
```

如果未设置，应用将使用构建时打包的快照（完全离线可用）。

### 3️⃣ 使用 Web 前端选课

打开已部署的应用（如 `https://<user>.github.io/<repo>/`）：

- **导入课程** — 加载 JSON 快照或从云端同步
- **智能搜索与筛选** — 按课号、课名、教师、时间等条件快速定位
- **排班冲突检测** — 自动识别时间冲突的课程组合
- **本地保存** — 选课方案存储在浏览器 IndexedDB，支持离线查看和恢复

---

## 技术实现细节

### 爬虫设计

| 组件                  | 说明                                                           |
| --------------------- | -------------------------------------------------------------- |
| **SSO 登录**    | RSA 加密密码 + Cookie 会话管理                                 |
| **选课页解析**  | 动态读取隐藏字段，支持多学期、多轮次                           |
| **AJAX 接口**   | `.../zzxkyzb_*` 系列接口批量拉取教学班                       |
| **数据规范化**  | 统一的 JSON 字段，带 `hash` 与 `updateTimeMs` 用于增量校验 |
| **Cookie 加密** | 本地保存加密 Cookie（RSA），下次自动免密登录                   |

### 前端应用

- **框架** — SvelteKit + Vite（实时热更新）
- **组件库** — Fluent UI Web Components（微软设计语言）
- **数据存储** — Svelte store（响应式） + IndexedDB（持久化）
- **国际化** — 支持中英文（i18n 检查工具见 `scripts/check_i18n.py`）

### 部署

- **静态生成** — 构建后无需后端服务器，可部署到 GitHub Pages、Netlify 等
- **CI/CD** — 推送到 `main` 自动触发 GitHub Actions 构建和部署
- **缓存策略** — 课程数据存储在 `localStorage`，支持在线更新或完全离线使用

---

## 安全与隐私

- 🔐 **密码安全** — 密码仅用于一次性学校登录，不会被保存或上传

  - 推荐使用 `--password-stdin` 或环境变量临时传递
  - 首次登录后，脚本自动保存**加密 Cookie**，下次直接免密刷新
- 🗝️ **本地加密存储** — Cookie 加密密钥存储在本机

  - `crawler/.jwxt_cookie.enc.json` — 加密 Cookie
  - `crawler/.jwxt_cookie_rsa.pem` — RSA 私钥（🚫 **不要上传到 Git**）
  - 这些文件已在 `.gitignore` 中排除
- 📱 **浏览器隐私** — 选课数据仅存储在本地浏览器，不上传第三方服务器
- ⚖️ **责任使用** — 请合理控制爬虫频率，避免对学校服务器造成压力

---

## 文件与文件夹说明

| 路径              | 用途                                                  |
| ----------------- | ----------------------------------------------------- |
| `app/`          | SvelteKit 前端应用源代码与构建配置                    |
| `app/src/`      | Svelte 组件、路由、类型定义                           |
| `app/build/`    | 构建输出（静态 HTML/CSS/JS），可直接部署              |
| `crawler/`      | Python 爬虫与数据处理脚本                             |
| `crawler/data/` | 课程 JSON 快照（`current.json` 和 `terms/` 目录） |
| `scripts/`      | 辅助工具脚本（i18n 检查、开发验证等）                 |
| `docs/`         | 开发文档（状态机、架构等）                            |

---

## 故障排查

### Web 应用无法加载课程

1. **检查数据源配置** — 确认 `VITE_CRAWLER_*` 环境变量是否正确设置
2. **检查浏览器缓存** — 打开开发者工具 → Application → Clear site data
3. **检查 JSON 格式** — 使用 `python3 -m json.tool crawler/data/current.json` 验证

### 爬虫登录失败

1. **确认学号和密码** — 逐字检查是否正确
2. **检查学校网络** — 确认可以访问 `https://jwxt.shu.edu.cn`
3. **重新清除 Cookie** — `uv run jwxt-crawler --clear-cookie-store` 后重试
4. **启用调试** — 查看爬虫日志了解具体失败步骤

### 导入课程后部分课程不显示

- 可能原因：课程数据格式不完整或有缺失字段
- 解决：检查 `app/src/lib/types/course.ts` 中的必需字段，并对照 JSON 是否包含所有字段

---

## 开发与贡献

### 本地开发环境

```bash
# 安装依赖
cd app && npm install
cd ../crawler && uv pip install -e .

# 运行开发服务器（前端）
cd app && npm run dev

# 在另一个终端爬取最新数据
cd crawler && uv run jwxt-crawler --output-dir ../app/static/data
```

### 代码检查

```bash
# 检查 i18n 文案完整性
python3 scripts/check_i18n.py all

# 快速验证开发环境
bash scripts/dev-smoke.sh
```

### 提交与发布

- 创建特性分支并在 PR 中说明功能与测试方法
- 确保所有文案已通过 i18n 检查
- 合并后自动部署到 GitHub Pages
