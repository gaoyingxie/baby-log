/**
 * 宝宝成长记录 - 自动化测试
 * 运行方式: node test.js
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// 读取HTML
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

// 运行测试
async function runTests() {
  console.log('========================================');
  console.log('宝宝成长记录 - 自动化测试');
  console.log('========================================\n');

  // 创建DOM - 配置storage
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://gaoyingxie.github.io/baby-log/',
    pretendToBeVisual: true,
    storage: {
      localStorage: 'http://localhost',
      sessionStorage: 'http://localhost'
    }
  });
  const { window } = dom;
  const { document } = window;

  // 手动初始化localStorage
  const localStorageData = {};
  window.localStorage = {
    getItem: (key) => localStorageData[key] || null,
    setItem: (key, value) => { localStorageData[key] = value; },
    removeItem: (key) => { delete localStorageData[key]; },
    clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); }
  };

  // 等待脚本执行
  await new Promise(r => setTimeout(r, 500));

  // ========== 1. 页面结构测试 ==========
  console.log('--- 页面结构 ---');

  test('页面标题正确', () => {
    const title = document.querySelector('title');
    assert(title.textContent === '宝宝成长记录');
  });

  test('版本号显示', () => {
    const version = document.querySelector('.version');
    assert(version && version.textContent.includes('v0.9'));
  });

  test('顶部标题显示宝宝信息', () => {
    const babyName = document.getElementById('headerBabyName');
    const babyAge = document.getElementById('headerBabyAge');
    assert(babyName && babyAge);
  });

  test('Tab导航存在', () => {
    const tabs = document.querySelectorAll('.tab-btn');
    assert(tabs.length === 2, `Tab数量=${tabs.length}, 期望=2`);
    assert(tabs[0].textContent.includes('记录'));
    assert(tabs[1].textContent.includes('历史'));
  });

  // ========== 2. 记录按钮测试 ==========
  console.log('\n--- 记录按钮 ---');

  test('记录按钮存在且数量正确', () => {
    const buttons = document.querySelectorAll('.record-btn');
    // 4个记录按钮 + 1个体重按钮
    assert(buttons.length >= 4, `按钮数量=${buttons.length}`);
  });

  test('大便按钮存在', () => {
    const poopBtn = document.querySelector('.record-btn.poop');
    assert(poopBtn);
    assert(poopBtn.textContent.includes('大便'));
  });

  test('小便按钮存在', () => {
    const peeBtn = document.querySelector('.record-btn.pee');
    assert(peeBtn);
    assert(peeBtn.textContent.includes('小便'));
  });

  test('瓶喂按钮存在', () => {
    const milkBtn = Array.from(document.querySelectorAll('.record-btn')).find(b => b.textContent.includes('瓶喂'));
    assert(milkBtn);
  });

  test('亲喂按钮存在', () => {
    const breastBtn = Array.from(document.querySelectorAll('.record-btn')).find(b => b.textContent.includes('亲喂'));
    assert(breastBtn);
  });

  test('体重按钮存在', () => {
    const weightBtn = Array.from(document.querySelectorAll('.record-btn')).find(b => b.textContent.includes('体重'));
    assert(weightBtn);
  });

  // ========== 3. 今日统计测试 ==========
  console.log('\n--- 今日统计 ---');

  test('今日统计四个指标存在', () => {
    assert(document.getElementById('todayPoop'));
    assert(document.getElementById('todayPee'));
    assert(document.getElementById('todayMilkAmount'));
    assert(document.getElementById('todayFeedCount'));
  });

  test('统计数字初始化为0', () => {
    assert(document.getElementById('todayPoop').textContent === '0');
    assert(document.getElementById('todayPee').textContent === '0');
    assert(document.getElementById('todayMilkAmount').textContent === '0');
    assert(document.getElementById('todayFeedCount').textContent === '0');
  });

  test('点击统计弹出详情', () => {
    const poopStat = document.getElementById('todayPoop');
    assert(poopStat.parentElement.hasAttribute('onclick') || poopStat.parentElement.style.cursor === 'pointer');
  });

  // ========== 4. 弹窗测试 ==========
  console.log('\n--- 弹窗 ---');

  test('宝宝信息弹窗存在', () => {
    const modal = document.getElementById('babyInfoModal');
    assert(modal);
  });

  test('喂奶弹窗存在', () => {
    const modal = document.getElementById('milkModal');
    assert(modal);
  });

  test('体重弹窗存在', () => {
    const modal = document.getElementById('weightModal');
    assert(modal);
  });

  test('大便/小便弹窗存在', () => {
    const modal = document.getElementById('poopPeeModal');
    assert(modal);
  });

  test('亲喂弹窗存在', () => {
    const modal = document.getElementById('breastFeedModal');
    assert(modal);
  });

  test('清空确认弹窗存在', () => {
    const modal = document.getElementById('clearConfirmModal');
    assert(modal);
  });

  // ========== 5. 历史页面测试 ==========
  console.log('\n--- 历史页面 ---');

  test('历史筛选按钮存在(本周/本月/全部)', () => {
    const filters = document.querySelectorAll('.filter-btn[data-filter]');
    assert(filters.length === 3, `筛选按钮数量=${filters.length}`);
  });

  test('本周按钮默认选中', () => {
    const weekBtn = document.querySelector('.filter-btn[data-filter="week"]');
    assert(weekBtn && weekBtn.classList.contains('active'));
  });

  test('趋势图按钮存在', () => {
    const chartBtns = document.querySelectorAll('[data-chart]');
    assert(chartBtns.length === 3);
  });

  test('喝奶量趋势按钮默认选中', () => {
    const milkBtn = document.getElementById('chartBtnMilk');
    assert(milkBtn && milkBtn.classList.contains('active'));
  });

  test('历史列表容器存在', () => {
    const list = document.getElementById('historyList');
    assert(list);
  });

  // ========== 6. 设置菜单测试 ==========
  console.log('\n--- 设置菜单 ---');

  test('设置菜单弹窗存在', () => {
    const menu = document.getElementById('menuModal');
    assert(menu);
  });

  test('清空数据按钮存在', () => {
    const btns = document.querySelectorAll('#menuModal button');
    const hasClear = Array.from(btns).some(b => b.textContent.includes('清空'));
    assert(hasClear, '菜单中没有清空数据按钮');
  });

  test('导入按钮存在', () => {
    const importInput = document.getElementById('importFile');
    assert(importInput);
  });

  // ========== 7. 数据存储测试 ==========
  console.log('\n--- 数据存储 ---');
  console.log('   (localStorage测试需e2e环境，浏览器中验证)');

  test('getRecords函数存在', () => {
    assert(typeof window.getRecords === 'function');
  });

  test('addRecord函数存在', () => {
    assert(typeof window.addRecord === 'function');
  });

  test('saveRecords函数存在', () => {
    assert(typeof window.saveRecords === 'function');
  });

  // ========== 8. 宝宝信息测试 ==========
  console.log('\n--- 宝宝信息 ---');

  test('getBabyInfo函数存在', () => {
    assert(typeof window.getBabyInfo === 'function');
  });

  test('saveBabyInfo函数存在', () => {
    assert(typeof window.saveBabyInfo === 'function');
  });

  test('calcAge函数存在', () => {
    assert(typeof window.calcAge === 'function');
  });

  test('calcAge正确计算天数', () => {
    const birth = new Date();
    birth.setDate(birth.getDate() - 10);
    const age = window.calcAge(birth.toISOString());
    assert(age === '10天', `实际=${age}`);
  });

  test('calcAge正确计算月数', () => {
    const birth = new Date();
    birth.setMonth(birth.getMonth() - 2);
    const age = window.calcAge(birth.toISOString());
    assert(age.includes('个月'), `实际=${age}`);
  });

  // ========== 9. 辅助函数测试 ==========
  console.log('\n--- 辅助函数 ---');

  test('formatTime函数存在', () => {
    assert(typeof window.formatTime === 'function');
  });

  test('formatFull函数存在', () => {
    assert(typeof window.formatFull === 'function');
  });

  test('showToast函数存在', () => {
    assert(typeof window.showToast === 'function');
  });

  // ========== 10. 统计更新测试 ==========
  console.log('\n--- 统计更新 ---');

  test('updateStats函数存在', () => {
    assert(typeof window.updateStats === 'function');
  });

  test('updateBabyHeader函数存在', () => {
    assert(typeof window.updateBabyHeader === 'function');
  });

  test('今日统计DOM元素存在', () => {
    // 验证updateStats会操作这些DOM元素
    assert(document.getElementById('todayPoop') !== null);
    assert(document.getElementById('todayPee') !== null);
    assert(document.getElementById('todayMilkAmount') !== null);
    assert(document.getElementById('todayFeedCount') !== null);
  });

  // ========== 结果汇总 ==========
  console.log('\n========================================');
  console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('========================================');

  dom.window.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('测试运行失败:', e);
  process.exit(1);
});
