async page=>{
 await page.setViewportSize({width:1440,height:1000});for(const t of [0,1]){await page.goto('file:///D:/桌面文件/集合/光暗滑块-修复版本.html?t='+t);await page.waitForTimeout(250);await page.screenshot({path:`D:/桌面文件/集合/PROJECT DESK/output/playwright/phase7-original-slider-${t}.png`});}
 await page.goto('http://127.0.0.1:4318/?phase7=reference#library');await page.locator('main h1').waitFor();await page.screenshot({path:'D:/桌面文件/集合/PROJECT DESK/output/playwright/phase7-resources-image.png'});await page.getByRole('heading',{name:'视觉参考图（隔离验收）',exact:true}).click();await page.locator('.resource-image').waitFor();await page.screenshot({path:'D:/桌面文件/集合/PROJECT DESK/output/playwright/phase7-image-preview.png'});return {originalSourceRenderedAtBothEnds:true,imagePreview:true};
}
