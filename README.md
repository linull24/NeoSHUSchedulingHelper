# SHU Course Scheduler - JWXT Crawler

上海大学教务系统 (jwxk.shu.edu.cn) 课程爬虫，支持 OAuth 认证。

## 功能特性

- OAuth 2.0 认证登录
- 自动获取所有学期的选课批次
- 抓取完整课程信息（课程名、教师、时间、地点等）
- 输出标准化 JSON 格式数据

## 安装依赖

```bash
pip install -r requirements.txt
```

## 使用方法

### 基本用法

```bash
python jwxt_crawler.py -u <学号> -p <密码>
```

### 指定输出目录

```bash
python jwxt_crawler.py -u <学号> -p <密码> -o ./output
```

### 从标准输入读取密码

```bash
python jwxt_crawler.py -u <学号> --password-stdin
```

或使用交互式输入（不指定 -p 参数）：

```bash
python jwxt_crawler.py -u <学号>
```

## 输出格式

爬虫会在输出目录生成以下文件：

```
data/
├── current.json          # 学期列表
└── terms/
    ├── 2024-2025-1.json  # 各学期课程数据
    └── 2024-2025-2.json
```

每个学期文件包含：
- `backendOrigin`: 后端地址
- `termName`: 学期名称
- `updateTimeMs`: 更新时间戳
- `hash`: 数据哈希值
- `courses`: 课程列表
  - `courseId`: 课程号
  - `courseName`: 课程名
  - `credit`: 学分
  - `teacherId`: 教师工号
  - `teacherName`: 教师姓名
  - `teacherTitle`: 教师职称
  - `classTime`: 上课时间
  - `campus`: 校区
  - `position`: 教室
  - `capacity`: 容量
  - `number`: 已选人数
  - `limitations`: 限制条件

## 参考项目

- `ref/shu-course-data/`: OAuth 认证参考（TypeScript）
- `ref/CCSU_course/`: 正方教务选课助手
- `ref/CUMT-jwxt/`: 正方教务爬虫

## 注意事项

- 请妥善保管账号密码
- 建议使用环境变量或配置文件存储敏感信息
- 爬取频率请控制合理，避免对服务器造成压力
