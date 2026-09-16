import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';

const DEFAULT_TITLE = 'Contamos con toda la permisología para la importación de baterías';
const DEFAULT_HTML = 'En TLEC CARGO estamos autorizados para gestionar la importación de baterías de litio con todos los permisos y certificaciones vigentes. Tu carga viaja segura y cumpliendo con la normativa internacional.';

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

export default function BatteryBanner() {
  const [banner, setBanner] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    base44.functions.invoke('getBatteryBanner', {})
      .then((res) => {
        const data = res?.data || res;
        if (!alive || !data || data.error) return;
        setBanner(data);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const dismissedKey = useMemo(() => {
    if (!banner) return null;
    const contentHash = simpleHash(`${banner.title || ''}||${banner.html || ''}`);
    return `tlec_battery_banner_dismissed_${contentHash}`;
  }, [banner]);

  useEffect(() => {
    if (!banner || !dismissedKey) return;
    if (!banner.enabled) { setVisible(false); return; }
    // Verificar ventana de fechas
    const today = new Date().toISOString().slice(0, 10);
    if (banner.start_date && today < banner.start_date) { setVisible(false); return; }
    if (banner.end_date && today > banner.end_date) { setVisible(false); return; }
    // Verificar dismiss permanente
    try {
      if (localStorage.getItem(dismissedKey)) { setVisible(false); return; }
    } catch (_) {}
    setVisible(true);
  }, [banner, dismissedKey]);

  const handleClose = () => {
    try { localStorage.setItem(dismissedKey, '1'); } catch (_) {}
    setVisible(false);
  };

  if (!visible || !banner) return null;

  const title = banner.title || DEFAULT_TITLE;
  const html = banner.html || DEFAULT_HTML;

  return (
    <>
      <style>{`
        .battery-banner{
          position:relative;width:100%;box-sizing:border-box;overflow:hidden;
          background:#1E293B;color:#fff;border:1px solid rgba(52,211,153,.38);
          box-shadow:0 24px 60px rgba(15,23,42,.18);
          padding:2.5rem 1.5rem;
          display:flex;align-items:center;
        }
        @media(min-width:768px){.battery-banner{padding:3rem 3.5rem;}}
        .battery-banner:before{
          content:"";position:absolute;inset:0;
          background:radial-gradient(circle at 82% 26%,rgba(52,211,153,.14),transparent 31%),linear-gradient(135deg,rgba(255,255,255,.035),transparent 48%);
          pointer-events:none;
        }
        .battery-banner:after{
          content:"";position:absolute;left:1.5rem;right:1.5rem;bottom:2rem;height:1px;
          background:linear-gradient(90deg,rgba(52,211,153,.7),rgba(52,211,153,0));
        }
        @media(min-width:768px){.battery-banner:after{left:3.5rem;right:3.5rem;bottom:2.5rem;}}
        .battery-content{
          position:relative;z-index:1;width:100%;max-width:1320px;margin:0 auto;
          display:grid;grid-template-columns:1fr;gap:1.5rem;align-items:center;
          animation:banner-in .7s cubic-bezier(.2,.8,.2,1) both;
        }
        @media(min-width:768px){
          .battery-content{grid-template-columns:146px 1fr 62px;gap:3rem;}
        }
        .battery-icon-wrap{display:flex;justify-content:center;}
        @media(min-width:768px){.battery-icon-wrap{justify-content:flex-start;}}
        .battery-icon{
          width:96px;height:120px;border:6px solid #34D399;border-radius:20px;
          position:relative;display:flex;align-items:center;justify-content:center;
          box-shadow:0 0 0 10px rgba(52,211,153,.07),0 0 36px rgba(52,211,153,.2);
          animation:pulse-glow 3.2s ease-in-out infinite;
        }
        @media(min-width:768px){.battery-icon{width:146px;height:180px;border-width:8px;border-radius:24px;}}
        .battery-icon:before{
          content:"";position:absolute;top:-20px;width:40px;height:14px;border-radius:6px 6px 0 0;background:#34D399;
        }
        @media(min-width:768px){.battery-icon:before{top:-28px;width:58px;height:20px;border-radius:7px 7px 0 0;}}
        .battery-icon:after{
          content:"";width:34px;height:54px;background:#34D399;
          clip-path:polygon(56% 0,0 54%,38% 54%,29% 100%,100% 39%,60% 39%);
          filter:drop-shadow(0 0 10px rgba(52,211,153,.7));
        }
        @media(min-width:768px){.battery-icon:after{width:52px;height:82px;filter:drop-shadow(0 0 12px rgba(52,211,153,.7));}}
        .battery-copy{max-width:960px;}
        .battery-copy h2{
          margin:0 0 1rem;font-family:'Manrope',Inter,Arial,sans-serif;
          font-size:1.5rem;line-height:1.15;letter-spacing:-.025em;font-weight:800;color:#fff;
        }
        @media(min-width:768px){.battery-copy h2{font-size:2.25rem;margin-bottom:1.5rem;}}
        .battery-copy .battery-body{
          margin:0;font-family:Inter,Arial,sans-serif;font-size:1rem;line-height:1.65;color:#D7E2E1;max-width:930px;
        }
        @media(min-width:768px){.battery-copy .battery-body{font-size:1.25rem;}}
        .battery-copy .battery-body p{margin:0 0 .75rem;}
        .battery-copy .battery-body p:last-child{margin-bottom:0;}
        .battery-close{
          justify-self:center;width:48px;height:48px;border:1px solid rgba(52,211,153,.55);
          border-radius:50%;background:rgba(15,23,42,.32);color:#A7F3D0;font-size:24px;line-height:1;
          cursor:pointer;display:grid;place-items:center;
          transition:background-color .2s ease,color .2s ease,box-shadow .2s ease,transform .2s ease;
        }
        @media(min-width:768px){.battery-close{justify-self:end;align-self:start;margin-top:.5rem;width:62px;height:62px;font-size:34px;}}
        .battery-close:hover{background:#34D399;color:#10251F;box-shadow:0 0 24px rgba(52,211,153,.32);}
        .battery-close:active{transform:scale(.96);}
        .battery-close:focus-visible{outline:3px solid rgba(167,243,208,.8);outline-offset:5px;}
        @keyframes banner-in{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse-glow{
          0%,100%{box-shadow:0 0 0 10px rgba(52,211,153,.07),0 0 36px rgba(52,211,153,.2)}
          50%{box-shadow:0 0 0 16px rgba(52,211,153,.1),0 0 48px rgba(52,211,153,.3)}
        }
        @media(min-width:768px){
          @keyframes pulse-glow{
            0%,100%{box-shadow:0 0 0 12px rgba(52,211,153,.07),0 0 44px rgba(52,211,153,.2)}
            50%{box-shadow:0 0 0 18px rgba(52,211,153,.1),0 0 58px rgba(52,211,153,.3)}
          }
        }
      `}</style>
      <section className="battery-banner" role="region" aria-label="Anuncio de permisología de baterías">
        <div className="battery-content">
          <div className="battery-icon-wrap">
            <div className="battery-icon" aria-hidden="true" />
          </div>
          <div className="battery-copy">
            <h2>{title}</h2>
            <div className="battery-body" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
          <button className="battery-close" type="button" aria-label="Cerrar anuncio" onClick={handleClose}>×</button>
        </div>
      </section>
    </>
  );
}