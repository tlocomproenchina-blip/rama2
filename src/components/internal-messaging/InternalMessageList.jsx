import React from 'react';

export default function InternalMessageList({ messages, currentUserEmail }) {
  return (
    <div className="space-y-3 max-h-[28rem] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
      {!(messages || []).length ? (
        <p className="py-8 text-center text-sm text-slate-500">No hay mensajes todavía.</p>
      ) : messages.map((msg) => {
        const mine = msg.sender_email === currentUserEmail;
        return (
          <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${mine ? 'bg-primary text-white' : 'bg-white text-slate-800 border border-slate-200'}`}>
              <p className={`text-xs font-semibold ${mine ? 'text-white/80' : 'text-slate-500'}`}>{msg.sender_name} · {msg.sender_area || msg.sender_role || 'Equipo'}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{msg.message}</p>
              <p className={`mt-2 text-[11px] ${mine ? 'text-white/70' : 'text-slate-400'}`}>{new Date(msg.created_date).toLocaleString('es-VE')}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}