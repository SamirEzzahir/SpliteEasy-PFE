/* Browser integration check. Route all API requests to the isolated test backend. */
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const fixture = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
assert(fixture.username.startsWith('moneycheck_'), 'Use a disposable moneycheck account');
const output = path.dirname(process.argv[2]);

(async()=>{
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(token=>localStorage.setItem('spliteasy.token',token),fixture.token);
  await context.route('**/*',async route=>{
    const url = new URL(route.request().url());
    if(!url.pathname.startsWith('/api/') && url.port !== '8800') return route.continue();
    const response = await route.fetch({url:'http://127.0.0.1:8801'+url.pathname.replace(/^\/api/,'')+url.search});
    if(response.status()>=400) console.log('API failure',url.pathname,response.status());
    await route.fulfill({response});
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(30000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const ready=()=>page.locator('[data-testid="wallet-total"]').waitFor({timeout:60000});
  const close=()=>page.getByRole('dialog').waitFor({state:'hidden'});
  try {
    await page.goto('http://localhost:3100/money',{waitUntil:'domcontentloaded'});await ready();console.log('Wallet overview loaded');
    if(process.argv.includes('--inspect')) {
      console.log(await page.evaluate(()=>['.mw-dashboard','.mw-main','.mw-accounts','.mw-carousel','.mw-quick-actions','.mw-rail'].map(s=>{const e=document.querySelector(s),c=getComputedStyle(e),r=e.getBoundingClientRect();return {s,x:r.x,width:r.width,display:c.display,columns:c.gridTemplateColumns,minWidth:c.minWidth};})));
      return;
    }
    if(process.argv.includes('--forms')) {
      await page.setViewportSize({width:390,height:844});
      const walletBalance=async()=>Number((await (await context.request.get('http://127.0.0.1:8801/wallets/'+fixture.bankId,{headers:{Authorization:'Bearer '+fixture.token}})).json()).balance);
      const before=await walletBalance();
      await page.goto('http://localhost:3100/expenses');
      await page.getByRole('button',{name:'Add expense',exact:true}).first().click();
      let dialog=page.getByRole('dialog');
      await dialog.getByRole('combobox',{name:/^Group/}).selectOption(fixture.groupId);
      await dialog.getByLabel('Description',{exact:true}).fill('Mobile shared dinner');
      await dialog.getByLabel('Amount (MAD)',{exact:true}).fill('300');
      await dialog.getByLabel('Pay from wallet').selectOption(fixture.bankId);
      await dialog.getByLabel('Your budget').selectOption('NEC');
      await page.screenshot({path:path.join(output,'live-shared-expense-mobile.png'),fullPage:true});
      await dialog.getByRole('button',{name:'Add expense',exact:true}).click();await close();
      assert.equal(await walletBalance(),before-300);
      await page.goto('http://localhost:3100/debts-loans');
      await page.getByRole('button',{name:'Add Debt',exact:true}).first().click();dialog=page.getByRole('dialog');
      await dialog.getByLabel('Lender (who you owe)').fill('Mobile borrowing');
      await dialog.getByLabel('Amount (MAD)').fill('100');
      await dialog.getByLabel('Received into wallet').selectOption(fixture.bankId);
      await dialog.getByRole('button',{name:'Add Debt',exact:true}).click();await close();
      assert.equal(await walletBalance(),before-200);
      await page.getByRole('button',{name:'Pay',exact:true}).first().click();dialog=page.getByRole('dialog');
      await dialog.getByLabel('Amount (MAD)').fill('50');
      await dialog.getByLabel('Pay from wallet').selectOption(fixture.bankId);
      await dialog.getByRole('button',{name:'Record payment',exact:true}).click();await close();
      assert.equal(await walletBalance(),before-250);
      await page.goto('http://localhost:3100/money/budgets');
      await page.getByRole('button',{name:'Manage budget plans'}).click();dialog=page.getByRole('dialog');
      await dialog.getByLabel('Plan name').fill('Mobile savings plan');
      await dialog.getByRole('button',{name:'Save plan'}).click();await close();
      await page.getByRole('button',{name:'View history',exact:true}).first().click();
      await page.getByRole('dialog').getByText('Mobile shared dinner',{exact:true}).waitFor();
      assert.deepEqual(errors,[]);
      console.log('PASS: mobile shared expense deducts the full payment; borrowing and repayment update the chosen wallet; budget plan saves and history includes the expense.');
      return;
    }
    await page.getByRole('button',{name:'Create wallet',exact:true}).click();
    let dialog=page.getByRole('dialog');
    await dialog.getByLabel('Wallet name').fill('Freelance reserve');
    await dialog.getByRole('button',{name:'Add wallet type',exact:true}).click();
    await dialog.getByLabel('New wallet type').fill('Prime');
    await dialog.getByRole('button',{name:'Create type',exact:true}).click();
    await dialog.getByLabel('Wallet type',{exact:true}).locator('option:checked').filter({hasText:'Prime'}).waitFor({state:'attached'});
    await dialog.getByRole('button',{name:'Create wallet',exact:true}).click();await close();await ready();
    await page.reload();await ready();
    assert(await page.getByRole('link',{name:'View Freelance reserve'}).count());
    await page.getByRole('button',{name:'Add income',exact:true}).first().click();dialog=page.getByRole('dialog');
    await dialog.getByLabel('Record in wallet').selectOption({label:'Main bank · MAD 1,050.00'}).catch(()=>dialog.getByLabel('Record in wallet').selectOption(fixture.bankId));
    await dialog.getByLabel('Amount (MAD)',{exact:true}).fill('4800');
    await dialog.getByLabel('Description',{exact:true}).fill('Freelance project');
    await dialog.getByLabel('Income source',{exact:true}).fill('Freelancing');
    await dialog.getByLabel('Allocate this income').check();
    await dialog.getByRole('button',{name:'Save record',exact:true}).click();await close();await ready();
    await page.getByRole('button',{name:'Add expense',exact:true}).first().click();dialog=page.getByRole('dialog');
    await dialog.getByLabel('Paid from wallet').selectOption(fixture.bankId);
    await dialog.getByLabel('Amount (MAD)',{exact:true}).fill('250');
    await dialog.getByLabel('Description',{exact:true}).fill('Groceries');
    await dialog.getByLabel('Budget (optional)').selectOption('NEC');
    await dialog.getByRole('button',{name:'Save record',exact:true}).click();await close();await ready();
    await page.screenshot({path:path.join(output,'live-money-desktop.png'),fullPage:true});
    await page.getByRole('tab',{name:'Activity',exact:true}).click();
    await page.getByRole('heading',{name:'Money activity'}).first().waitFor();
    await page.getByText('Groceries',{exact:true}).first().waitFor();
    await page.getByRole('tab',{name:'Budgets',exact:true}).click();
    await page.getByRole('heading',{name:'Give your money a purpose'}).waitFor();
    assert.equal(await page.locator('.mw-budget').count(),6);
    await page.goto('http://localhost:3100/money/wallets/'+fixture.bankId);await page.getByRole('heading',{name:'Wallet history'}).waitFor();
    await page.getByRole('button',{name:'Adjust balance',exact:true}).click();
    dialog=page.getByRole('dialog');await dialog.getByLabel('Reason for adjustment').fill('Verified actual balance');
    await dialog.getByLabel('Correct balance (MAD)').fill('5600');
    await dialog.getByRole('button',{name:'Save record',exact:true}).click();await close();
    for(const width of [320,390,768,1440]){
      await page.setViewportSize({width,height:900});await page.goto('http://localhost:3100/money');await ready();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow at '+width);
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>document.documentElement.dataset.theme='dark');
    await page.screenshot({path:path.join(output,'live-money-mobile-dark.png'),fullPage:true});
    await page.evaluate(()=>window.dispatchEvent(new Event('money:open-actions')));
    await page.getByRole('dialog').waitFor();
    await page.screenshot({path:path.join(output,'live-money-mobile-actions.png'),fullPage:true});
    await page.getByRole('button',{name:'Close dialog'}).click();
    // A different account must receive an empty wallet view, never cached balances.
    await context.addInitScript(token=>localStorage.setItem('spliteasy.token',token),fixture.otherToken);
    await page.reload();await page.getByRole('heading',{name:'Your money starts here'}).waitFor();
    assert.equal(await page.getByRole('link',{name:'View Main bank'}).count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS: live wallet/type creation, persistence, income, spending, budgets, adjustment, account privacy, desktop/mobile layouts and action sheet.');
  } catch(error){console.log('Page:',page.url(),'runtime errors:',errors);await page.screenshot({path:path.join(output,'live-money-failure.png'),fullPage:true,timeout:5000}).catch(()=>{});throw error;}
  finally {await context.unrouteAll({behavior:'ignoreErrors'});await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
