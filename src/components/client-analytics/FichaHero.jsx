import React from 'react';

const HERO = 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/e72057d96_generated_82c68667.jpg';

export default function FichaHero({ children }) {
  return (
    <div className="relative overflow-hidden rounded-[20px] bg-[#262a2b] px-6 pt-12 pb-16 md:px-[72px] md:pt-14 md:pb-[72px]">
      <img src={HERO} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(38,42,43,.94)_0%,rgba(38,42,43,.78)_55%,rgba(38,42,43,.45)_100%)]" />
      <div className="relative flex flex-col gap-5 animate-[ficha-rise_.8s_cubic-bezier(.2,.7,.2,1)_both]">
        <span className="h-1 w-14 bg-[#c8692a]" />
        <h1 className="m-0 max-w-[760px] font-[Georgia,'Times_New_Roman',serif] text-4xl md:text-[60px] leading-[1.05] font-bold tracking-[-.01em] text-[#f6f1e4]">
          Analítica de clientes
        </h1>
        <p className="m-0 max-w-[640px] text-[17px] leading-relaxed text-[#d9d3c0]">
          Busca un cliente y visualiza su gasto, costos de envío y desempeño de consolidaciones.
        </p>
        <div className="mt-3 w-full max-w-[620px] rounded-[14px] bg-[#fbf8ef] shadow-[0_10px_30px_rgba(0,0,0,.25)] focus-within:shadow-[0_0_0_3px_rgba(200,105,42,.45),0_10px_30px_rgba(0,0,0,.25)]">
          {children}
        </div>
      </div>
    </div>
  );
}