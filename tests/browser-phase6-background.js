async page=>{
 // Playwright deliberately emulates focus/visibility on every page by default.
 // Disable only that test override so native tab visibility can be measured.
 const pages=page.context().pages();for(const p of pages){const cdp=await page.context().newCDPSession(p);await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});}
 const app=pages.find(p=>p.url().includes('4318'));if(!app)throw Error('验收页面不存在');return await app.evaluate(()=>({visible:document.visibilityState,focus:document.hasFocus()}));
}
