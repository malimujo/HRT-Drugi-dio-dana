const puppeteer = require('puppeteer');
const fs = require('fs');

async function updateM3U() {
  let browser;
  try {
    console.log('🚀 Pokrećem Chrome...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    console.log('📄 Učitavam https://radio.hrt.hr/slusaonica/drugi-dio-dana');
    await page.goto('https://radio.hrt.hr/slusaonica/drugi-dio-dana', { 
      waitUntil: 'networkidle2'
    });
    
    await new Promise(r => setTimeout(r, 4000));
    
    // 🎯 NAZIV + MP3 u jednom evaluate
    const result = await page.evaluate(() => {
      // 1. NAZIV - trenutni datum format "Drugi dio dana 09.03.2026."
      const danasnjiDatum = new Date();
      const dan = danasnjiDatum.getDate().toString().padStart(2, '0');
      const mjesec = (danasnjiDatum.getMonth() + 1).toString().padStart(2, '0');
      const episodeTitle = `Drugi dio dana ${dan}.${mjesec}`;
      
      const allLinks = Array.from(document.querySelectorAll('a[href], script, img'));
      
      // 2. MP3 link
      for (const link of allLinks) {
        const href = link.href || link.src || link.getAttribute('data-src');
        if (href && href.includes('api.hrt.hr/media') && href.includes('.mp3')) {
          return { mp3: href, image: null, title: episodeTitle };
        }
      }
      
      // 3. Slika
      let imageUrl = null;
      for (const img of allLinks) {
        const src = img.src || img.getAttribute('data-src');
        if (src && src.includes('api.hrt.hr/media') && (src.includes('.webp') || src.includes('.jpg'))) {
          imageUrl = src;
          break;
        }
      }
      
      // 4. ✅ ISPRAVLJEN REGEX
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const content = script.textContent || script.innerHTML;
        const mp3Match1 = content.match(/"https?:\/\/api\.hrt\.hr\/media[^"]*\.mp3[^"]*"/);
        const mp3Match2 = content.match(/'https?:\/\/api\.hrt\.hr\/media[^']*\.mp3[^']*'/);
        if (mp3Match1) return { mp3: mp3Match1[0].slice(1, -1), image: imageUrl, title: episodeTitle };
        if (mp3Match2) return { mp3: mp3Match2[0].slice(1, -1), image: imageUrl, title: episodeTitle };
      }
      
      return { mp3: null, image: null, title: episodeTitle };
    });
    
    console.log('🎵 MP3:', result.mp3);
    console.log('🖼️ Slika:', result.image);
    console.log('📺 Naslov:', result.title);
    
    if (result.mp3) {
      // Vrijeme iz MP3 filename-a
      const timeMatch = result.mp3.match(/(\d{4})(\d{2})(\d{2})(\d{6})\.mp3$/);
      let finalTitle = result.title;
      
      if (timeMatch) {
        const dan = timeMatch[3];
        const mjesec = timeMatch[2];
        const sat = timeMatch[4].slice(0,2);
        const minute = timeMatch[4].slice(2,4);
        finalTitle = `${result.title} ${dan}.${mjesec}. ${sat}:${minute}`;
      }
      
      console.log('📅 Konačni naslov:', finalTitle);
      
      const imageUrl = result.image || 'https://radio.hrt.hr/favicon.ico';
      const m3uContent = `#EXTM3U
#EXTINF:-1 tvg-logo="${imageUrl}" group-title="Glazba",${finalTitle}
${result.mp3}`;

      fs.writeFileSync('Drugi_dio_dana.m3u', m3uContent);
      console.log('✅ M3U spreman!');
    } else {
      throw new Error('Nema MP3-a');
    }
    
  } catch (error) {
    console.error('❌', error.message);
    const danasnjiDatum = new Date();
    const dan = danasnjiDatum.getDate().toString().padStart(2, '0');
    const mjesec = (danasnjiDatum.getMonth() + 1).toString().padStart(2, '0');
    const fallbackTitle = `Drugi dio dana ${dan}.${mjesec}. 06:15`;
    
    const fallbackContent = `#EXTM3U
#EXTINF:-1 tvg-logo="https://radio.hrt.hr/favicon.ico",${fallbackTitle}
https://api.hrt.hr/media/28/da/20260310-dogodilo-se-na-danasnji-dan-37328741-20260310061500.mp3`;
    fs.writeFileSync('Drugi_dio_dana.m3u', fallbackContent);
    console.log('✅ Fallback spreman');
  } finally {
    if (browser) await browser.close();
  }
}

updateM3U();
