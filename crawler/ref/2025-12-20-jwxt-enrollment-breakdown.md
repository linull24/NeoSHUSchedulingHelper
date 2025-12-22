# JWXT “已选人数明细”（点击已选人数）— 端点与字段（脱敏）

## 来源（ref）

- `crawler/ref/Auto_courseGrabber/web结构/自主选课_files/zzxkYzb.js`
  - UI 构造 “已选/容量” 可点击链接：`onclick="ckjxbrsxx(kch_id,jxb_id)"`
  - `ckjxbrsxx(kch_id,jxb_id)` 打开 “已选人数明细” 弹窗并请求后端页面

## 请求

- Method: `POST`
- URL: `https://jwxt.shu.edu.cn/jwglxt/xkgl/common_cxJxbrsmxIndex.html?gnmkdm=N253512`
- Body (form):
  - `kch_id`: 课程号
  - `jxb_id`: 教学班 id
  - `xnm`: 学年（通常等于 selection page 的 `xkxnm`）
  - `xqm`: 学期（通常等于 selection page 的 `xkxqm`）

## 返回

- Content-Type: HTML（弹窗内容）
- 内容通常包含一个表格，逐行展示某教学班在不同“人群类别/批次类别”的已选人数拆分，例如（字段名称可能随学期系统升级变化）：
  - `预置已选人数`
  - `培养方案已选人数`
  - `高年级已选人数`
  - `其他已选人数`（有时带 `★` 标记）
  - `总计`

## 重要说明

- 该端点提供的是“已选人数按类别拆分”，并不直接等于“当前用户属于哪个批次/人群”。
- “用户所属批次/人群”是用户态信息，需要 userscript 在运行时从 `user profile signals` 推断（TBD），不得写入云端快照/同步 bundle。

## MCP / Console 快速验证（只读）

在 JWXT 选课页（同源）可直接 `fetch` 该端点验证返回是否包含 `总计/预置` 等字段：

```js
const kch_id = '<KCH_ID>';
const jxb_id = '<JXB_ID>';
const xnm = document.querySelector('#xkxnm')?.value || '2025';
const xqm = document.querySelector('#xkxqm')?.value || '16';

const res = await fetch('/jwglxt/xkgl/common_cxJxbrsmxIndex.html?gnmkdm=N253512', {
  method: 'POST',
  headers: {
    'x-requested-with': 'XMLHttpRequest',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
  },
  body: new URLSearchParams({ kch_id, jxb_id, xnm, xqm })
});
console.log(res.status, (await res.text()).includes('总计'));
```
