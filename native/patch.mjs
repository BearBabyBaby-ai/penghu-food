// 澎湖美食推薦 原生專案調整：版本號、返回鍵、狀態列顏色、圖示、啟動畫面
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const A = 'android/app';
const RES = `${A}/src/main/res`;
const ICON = 'icon.png';
const VERSION_CODE = 2;
const VERSION_NAME = '1.0.1';
const BAR = '#19394a';
const PAGE = '#f2f6f7';
const ICON_EDGE = '#1d9fd0';

const edit = (file, fn) => { const s = fs.readFileSync(file, 'utf8'); const t = fn(s); if (t === s) throw new Error(`未修改：${file}`); fs.writeFileSync(file, t); };

// 1. 版本號（之後每次更新原生外殼都要調高，才能直接覆蓋安裝）
edit(`${A}/build.gradle`, s => s.replace(/versionCode \d+/, `versionCode ${VERSION_CODE}`).replace(/versionName "[^"]*"/, `versionName "${VERSION_NAME}"`));

// 2. 手機返回鍵：能回上一頁就回上一頁，沒有上一頁就離開 App
const javaDir = `${A}/src/main/java/io/github/bearbabybaby_ai/penghufood`;
fs.mkdirSync(javaDir, { recursive: true });
fs.writeFileSync(`${javaDir}/MainActivity.java`, `package io.github.bearbabybaby_ai.penghufood;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (bridge != null && bridge.getWebView() != null && bridge.getWebView().canGoBack()) {
                    bridge.getWebView().goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });
    }
}
`);

// 3. 狀態列顏色（與頁首同色），內容不延伸到狀態列底下
const styles = (v35) => `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="colorPrimary">${BAR}</item>
        <item name="colorPrimaryDark">${BAR}</item>
        <item name="colorAccent">${BAR}</item>
    </style>
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <item name="android:statusBarColor">${BAR}</item>
        <item name="android:navigationBarColor">#FFFFFF</item>${v35 ? '\n        <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>' : ''}
    </style>
    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
        <item name="windowSplashScreenBackground">${PAGE}</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>
</resources>
`;
fs.writeFileSync(`${RES}/values/styles.xml`, styles(false));
fs.mkdirSync(`${RES}/values-v35`, { recursive: true });
fs.writeFileSync(`${RES}/values-v35/styles.xml`, styles(true));

// 4. 圖示：滿版，整張圖鋪滿圖示可見範圍
const blurred = (size, k) => sharp(ICON).resize(size, size).blur(Math.max(1, 8 * k)).png().toBuffer();
const ROUND = 58;   /* 圓形圖示裡圖的大小（dp），可見圓為 72dp */
const roundFill = async (size, pic, k) => {
  const pad = Math.floor((size - pic) / 2);
  const edge = await sharp(ICON).resize(pic, pic).extend({ top: pad, left: pad, bottom: size - pic - pad, right: size - pic - pad, extendWith: 'mirror' }).blur(Math.max(0.6, 1.5 * k)).png().toBuffer();
  return sharp(edge).composite([{ input: await sharp(ICON).resize(pic, pic).png().toBuffer(), left: pad, top: pad }]).png().toBuffer();
};
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(DENS)) {
  const dir = `${RES}/mipmap-${d}`;
  fs.mkdirSync(dir, { recursive: true });
  const legacy = Math.round(48 * k), fg = Math.round(108 * k);
  await sharp(ICON).resize(legacy, legacy).png().toFile(`${dir}/ic_launcher.png`);
  // 圓形圖示：圖稍微縮小，讓「澎湖美食」完整落在圓內；四周用圖片邊緣鏡射後模糊補滿
  const legacyPic = Math.round(legacy * ROUND / 72);
  await sharp(await roundFill(legacy, legacyPic, k)).composite([{ input: Buffer.from(`<svg width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`), blend: 'dest-in' }]).png().toFile(`${dir}/ic_launcher_round.png`);
  const roundPic = Math.round(ROUND * k);
  await sharp(await roundFill(fg, roundPic, k)).png().toFile(`${dir}/ic_launcher_round_bg.png`);
  await sharp({ create: { width: fg, height: fg, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: await sharp(ICON).resize(roundPic, roundPic).png().toBuffer(), gravity: 'center' }]).png().toFile(`${dir}/ic_launcher_round_foreground.png`);
  const inner = Math.round(72 * k);   /* 72dp＝圖示可見範圍，圖鋪滿 */
  const pic = await sharp(ICON).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: fg, height: fg, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: pic, gravity: 'center' }]).png().toFile(`${dir}/ic_launcher_foreground.png`);
  await sharp(await blurred(fg, k)).png().toFile(`${dir}/ic_launcher_bg.png`);
}
fs.rmSync(`${RES}/drawable-v24/ic_launcher_foreground.xml`, { force: true });
fs.writeFileSync(`${RES}/drawable/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android"><solid android:color="${ICON_EDGE}"/></shape>\n`);
fs.rmSync(`${RES}/values/ic_launcher_background.xml`, { force: true });
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_bg"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
fs.writeFileSync(`${RES}/mipmap-anydpi-v26/ic_launcher.xml`, adaptive);
// 手機用圓形圖示時（系統會改用 roundIcon），用縮小版讓「澎湖美食」完整顯示
fs.writeFileSync(`${RES}/mipmap-anydpi-v26/ic_launcher_round.xml`, `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_round_bg"/>
    <foreground android:drawable="@mipmap/ic_launcher_round_foreground"/>
</adaptive-icon>
`);

// 5. 啟動畫面：頁面底色＋圖示
for (const dir of fs.readdirSync(RES).filter(n => n.startsWith('drawable'))) {
  const f = path.join(RES, dir, 'splash.png');
  if (!fs.existsSync(f)) continue;
  const { width, height } = await sharp(f).metadata();
  const size = Math.round(Math.min(width, height) * 0.4);
  const icon = await sharp(ICON).resize(size, size).png().toBuffer();
  await sharp({ create: { width, height, channels: 3, background: PAGE } }).composite([{ input: icon, gravity: 'center' }]).png().toFile(f + '.tmp');
  fs.renameSync(f + '.tmp', f);
}
console.log('原生專案調整完成');
