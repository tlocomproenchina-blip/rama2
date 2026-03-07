import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Facebook, Instagram, Linkedin, Twitter } from 'lucide-react';

export default function HomeFooter() {
  return (
    <footer className="bg-slate-900 text-slate-400 pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black bg-gradient-to-r from-blue-500 to-blue-700 bg-clip-text text-transparent">TLEC</span>
            <span className="text-2xl font-black text-white">CARGO</span>
          </div>
          <p className="mt-3 text-sm">Envíos internacionales desde China a Venezuela con transparencia y soporte.</p>
          <div className="mt-4 flex items-center gap-3">
            {[Facebook, Instagram, Linkedin, Twitter].map((Icon, i) => (
              <a key={i} href="#" className="h-10 w-10 rounded-lg bg-slate-800 hover:bg-blue-600 flex items-center justify-center transition-colors">
                <Icon className="h-5 w-5 text-slate-300" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-white font-bold">Navegación</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><a href="#features" className="hover:text-blue-400">Beneficios</a></li>
            <li><a href="#process" className="hover:text-blue-400">Proceso</a></li>
            <li><a href="#services" className="hover:text-blue-400">Servicios</a></li>
            <li><a href="#pricing" className="hover:text-blue-400">Tarifas</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold">Servicios</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li>Marítimo</li>
            <li>Aéreo</li>
            <li>Seguro</li>
            <li>Puerta a puerta</li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold">Contacto</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to={createPageUrl('Support')} className="hover:text-blue-400">Soporte</Link></li>
            <li><a href="#" className="hover:text-blue-400">WhatsApp</a></li>
            <li><a href="#" className="hover:text-blue-400">Email</a></li>
          </ul>
        </div>
      </div>
      <div className="mt-8 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">© {new Date().getFullYear()} TLEC CARGO. Todos los derechos reservados.</div>
    </footer>
  );
}