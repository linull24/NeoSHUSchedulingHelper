import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	buildQueryContext,
	parseSelectionPageFields,
	parseSelectionRoundTabs,
	parseEnrollmentBreakdownHtml
} from '../shared/jwxtCrawler';

async function readFixture(relativePathFromRepoRoot: string): Promise<string> {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	const repoRoot = path.resolve(__dirname, '..', '..');
	return fs.readFile(path.join(repoRoot, relativePathFromRepoRoot), 'utf8');
}

async function main() {
	const selectionHtml = await readFixture('crawler/ref/Auto_courseGrabber/web结构/自主选课.html');
	const fields = parseSelectionPageFields(selectionHtml);

	assert.ok(fields.xkkz_id, 'selection fields should include xkkz_id');
	assert.ok(fields.xkxnm, 'selection fields should include xkxnm');
	assert.ok(fields.xkxqm, 'selection fields should include xkxqm');

	const ctx = buildQueryContext(fields);
	assert.ok(ctx.xkkz_id, 'query context should include xkkz_id');
	assert.equal(ctx.xnm, ctx.xkxnm, 'xnm should mirror xkxnm');
	assert.equal(ctx.xqm, ctx.xkxqm, 'xqm should mirror xkxqm');

	const tabsHtml = `
    <ul id="nav_tab">
      <li class="active"><a onclick="queryCourse(this,'01','XKKZ1','NJ1','ZY1')">公共课</a></li>
      <li><a onclick="queryCourse(this,'02','XKKZ2','NJ2','ZY2')">专业课</a></li>
    </ul>
  `;
	const tabs = parseSelectionRoundTabs(tabsHtml);
	assert.equal(tabs.length, 2, 'should parse two tabs from onclick HTML');
	assert.equal(tabs[0]?.active, true, 'first tab should be active');
	assert.equal(tabs[0]?.xkkzId, 'XKKZ1');
	assert.equal(tabs[0]?.kklxdm, '01');

	const breakdownHtml = await readFixture('crawler/ref/fixtures/jwxt_enrollment_breakdown_sample.html');
	const breakdown = parseEnrollmentBreakdownHtml(breakdownHtml);
	assert.ok(breakdown.items.length >= 3, 'breakdown should include multiple rows');
	assert.equal(breakdown.total, 18, 'breakdown total should parse');
	assert.equal(breakdown.userBatchLabel, '其他已选人数', 'should capture ★ user batch label');

	// eslint-disable-next-line no-console
	console.log('[selftest] jwxt parsers ok');
}

await main();
