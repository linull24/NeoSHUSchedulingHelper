// ==UserScript==
// @name         鼠鼠选课plus
// @version      0.5
// @description  更好的课表显示&排名查看
// @author       IAFEnvoy
// @match        https://jwxt.shu.edu.cn/jwglxt/xsxk/*
// @grant        none
// ==/UserScript==

const continuedTimeRegex = /星期([一二三四五六日])第([0-9]+)-([0-9]+)节{([0-9]+)-([0-9]+)周(\(([单双])\))?}/
const separatedTimeRegex = /星期([一二三四五六日])第([0-9]+)-([0-9]+)节{(([0-9]+)周(,([0-9]+)周)*)}/
const weekday = '空一二三四五六日'

let rawData = [], courseCache, tableCache

async function process() {
    let totalPoint = 0
    tableCache = Array.from({ length: 8 }, _ => Array.from({ length: 13 }, _ => Array.from({ length: 17 }, _ => 'yellowgreen')))
    let classes = document.getElementsByClassName('outer_xkxx_list')
    for (let c of classes) {
        let kch_id = c.id.replace('right_', '')
        let raw = rawData.filter(x => rawData[x].kch_id == kch_id)[0]
        if (!raw) continue
        totalPoint += +raw.jxbxf
        let title = c.querySelector('h6'), type = c.querySelector('font').innerText
        title.addEventListener('click', () => ckjxbrsxx(kch_id, raw.jxb_id))
        await requestSelected(kch_id, raw.jxb_id, title, raw)
        for (let t of raw.sksj.split('<br/>'))
            fillTime(t, type == '待筛选' ? 'red' : 'aqua', tableCache)
    }
    drawTable(tableCache)
    document.getElementById('xskbtable').rows[13].innerHTML = `<td colspan="8">
		<div class="col-md-12 col-sm-12">
		<div class="col-md-4 col-sm-4"><p style="margin-right:5px;float:left;background-color:red;height:15px;width:30px;"></p>待筛选</div>
		<div class="col-md-4 col-sm-4"><p style="margin-right:5px;float:left;background-color:aqua;height:15px;width:30px;"></p>已选上</div>
		<div class="col-md-4 col-sm-4"><p style="margin-right:5px;float:left;background-color:yellowgreen;height:15px;width:30px;"></p>未占用</div>
		<div class="col-md-4 col-sm-4">学分：${totalPoint}</div>
		</div></td>`
}

function drawTable(table) {
    for (let i = 1; i <= 7; i++)
        for (let j = 1; j <= 12; j++) {
            let ele = document.getElementById(`td_${i}-${j}`)
            ele.innerText = summarizeRanges(table[i][j])
            ele.style.background = formatBackgroundString(table[i][j])
        }
}

function fillTime(time, color, table) {
    let result = continuedTimeRegex.exec(time)
    if (result != null && result.length >= 6) {
        let day = weekday.indexOf(result[1])
        let sectionStart = +result[2], sectionEnd = +result[3], weekStart = +result[4], weekEnd = +result[5]
        let odd = result[7] != '双', even = result[7] != '单'
        for (let i = sectionStart; i <= sectionEnd; i++)
            for (let j = weekStart; j <= weekEnd; j++)
                if (j % 2 == 0 && even || j % 2 == 1 && odd)
                    table[day][i][j] = color
    } else {
        result = separatedTimeRegex.exec(time)
        if (result != null && result.length >= 5) {
            let day = weekday.indexOf(result[1])
            let sectionStart = +result[2], sectionEnd = +result[3], weeks = result[4].replaceAll('周', '').split(',')
            for (let i = sectionStart; i <= sectionEnd; i++)
                for (let week of weeks)
                    table[day][i][+week] = color
        }
    }
}

function checkConflict(table, time) {
    let result = continuedTimeRegex.exec(time)
    if (result != null && result.length >= 6) {
        let day = weekday.indexOf(result[1])
        let sectionStart = +result[2], sectionEnd = +result[3], weekStart = +result[4], weekEnd = +result[5]
        let odd = result[7] != '双', even = result[7] != '单'
        for (let i = sectionStart; i <= sectionEnd; i++)
            for (let j = weekStart; j <= weekEnd; j++)
                if (j % 2 == 0 && even || j % 2 == 1 && odd)
                    if (table[day][i][j] != 'yellowgreen') return true
    } else {
        result = separatedTimeRegex.exec(time)
        if (result != null && result.length >= 5) {
            let day = weekday.indexOf(result[1])
            let sectionStart = +result[2], sectionEnd = +result[3], weeks = result[4].replaceAll('周', '').split(',')
            for (let i = sectionStart; i <= sectionEnd; i++)
                for (let week of weeks)
                    if (table[day][i][+week] != 'yellowgreen') return true
        }
    }
    return false
}

function summarizeRanges(list) {
    const filtered = list.slice(1, 17).map((x, i) => x != 'yellowgreen' ? i + 1 : null).filter(idx => idx !== null)
    if (filtered.length === 0) return ''
    let ranges = []
    let start = filtered[0]
    let end = filtered[0]
    for (let i = 1; i < filtered.length; i++) {
        if (filtered[i] === end + 1) end = filtered[i]
        else {
            if (start) ranges.push(start === end ? `${start}` : `${start}-${end}`)
            start = end = filtered[i]
        }
    }
    if (start) ranges.push(start === end ? `${start}` : `${start}-${end}`)
    return ranges.join(', ')
}

function formatBackgroundString(list) {
    let percentage = 100 / 16, colors = []
    for (let i = 1; i <= 16; i++)
        colors.push(`${list[i]} ${(i - 1) * percentage}% ${i * percentage}%`)
    return `linear-gradient(to right, ${colors.join(', ')})`
}

async function requestSelected(kch_id, jxb_id, obj, raw) {
    if (obj.innerHTML.indexOf('排名') > 0) return
    let parser = new DOMParser()
    let data = new FormData()
    data.append('kch_id', kch_id)
    data.append('jxb_id', jxb_id)
    data.append('xnm', $('#xkxnm').val())
    data.append('xqm', $('#xkxqm').val())
    let html = await fetch(`${_path}/xkgl/common_cxJxbrsmxIndex.html?time=${Date.now()}&gnmkdm=N253512`, {
        method: 'POST',
        body: data
    }).catch(console.error).then(res => res.text())
    let doc = parser.parseFromString(html, 'text/html')
    let table = doc.querySelectorAll("table")[0]
    let start = 0, end = 0
    for (let i = 1; i <= 4; i++) {
        end += +table.rows[i].cells[1].innerText
        if (table.rows[i].cells[2].innerText.indexOf('★') != -1) break
        start += +table.rows[i].cells[1].innerText
    }
    obj.innerHTML += `&nbsp;&nbsp;&nbsp;&nbsp;排名/容量：${start + 1}-${end}/${raw.jxbrs}&nbsp;点击查看详情`
}

function initialize() {
    initializeHandler()
    let div1 = document.createElement('div')
    div1.innerHTML = `<div class="col-sm-12 col-md-12 condition-row" style="display: block;">
        <div class="form-group form-group-sm" style="margin-bottom:5px;">
            <label class="col-sm-2 col-md-2 control-label title">教师姓名/教师工号：</label><div class="col-sm-9 col-md-9 items">
                <ul>
                    <li class="col-sm-12 col-md-12"
                        <div class="input-group input-group-xs">
                            <input type="text" id="teacherFilter" class="form-control pull-left input-xs input-xs-last fixed">
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    </div>`
    document.getElementsByClassName("condition-item")[0].appendChild(div1)
    let div2 = document.createElement('div')
    div2.innerHTML = `<div class="col-sm-12 col-md-12 condition-row" style="display: block;">
        <div class="form-group form-group-sm" style="margin-bottom:5px;">
            <label class="col-sm-2 col-md-2 control-label title">隐藏冲突课程：</label><div class="col-sm-9 col-md-9 items">
                <ul>
                    <li class="col-sm-12 col-md-12"
                        <div class="input-group input-group-xs">
                            <input type="checkbox" id="hideConflict" class="form-control pull-left input-xs input-xs-last fixed">
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    </div>`
    document.getElementsByClassName("condition-item")[0].appendChild(div2)
}

let loaded = false, warned = false
function initializeHandler() {
    if (!loaded) {
        for (let o of document.getElementsByClassName('outer_left')) {
            o.addEventListener('click', () => setTimeout(process, 1000))
            loaded = true
        }
    }
}

(function () {
    'use strict'
    //hoot for $.post
    const originalPost = window.jQuery?.post;
    window.jQuery.post = function (url, data, callback, type) {
        const newCallback = function (responseData, textStatus, jqXHR) {
            console.log('Hooked POST data ', url, responseData)
            if (url.indexOf('zzxkyzb_cxZzxkYzbChoosedDisplay') != -1)
                rawData = responseData
            else if (url.indexOf('zzxkyzbjk_cxJxbWithKchZzxkYzb') != -1) {
                courseCache = responseData
                setTimeout(() => {
                    for (let { jxb_id, sksj, jsxx } of courseCache) {
                        let obj = document.getElementById(`tr_${jxb_id}`)
                        //teacher filter
                        let teacherFilter = document.getElementById('teacherFilter').value
                        if (jsxx.indexOf(teacherFilter) == -1) obj.hidden = true
                        //check conflict
                        let hideConflict = document.getElementById('hideConflict').checked
                        if (tableCache) {
                            let conflict = false
                            for (let t of sksj.split('<br/>'))
                                if (checkConflict(tableCache, t)) {
                                    conflict = true
                                    break
                                }
                            if (conflict) {
                                if (hideConflict) obj.hidden = true
                                else obj.style.backgroundColor = 'lightpink'
                            }
                        } else if (hideConflict && !warned) {
                            alert('课表未缓存，无法显示冲突信息！\n请打开右侧课表栏等待加载完再重新查询')
                            warned = true
                        }
                        //preview events
                        obj.addEventListener('mouseenter', _ => {
                            if (!tableCache) return
                            let tempTable = structuredClone(tableCache)
                            for (let t of sksj.split('<br/>'))
                                fillTime(t, 'mediumpurple', tempTable)
                            drawTable(tempTable)
                        })
                        obj.addEventListener('mouseleave', _ => {
                            if (!tableCache) return
                            drawTable(tableCache)
                        })
                    }
                }, 500)
            }
            if (typeof callback === 'function')
                callback(responseData, textStatus, jqXHR)
        }
        return originalPost.apply(this, [url, data, newCallback, type])
    }
    //initialize
    setTimeout(initialize, 1000)
    document.addEventListener('click', initializeHandler)
})()