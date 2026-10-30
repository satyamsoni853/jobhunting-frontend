import { useEffect, useState } from 'react';
import { TOAST_EVENT } from './toastBus.js';

export default function Toasts() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let id = 0;
    const onToast = (e) => {
      const item = { id: ++id, ...e.detail };
      setItems((list) => [...list.slice(-3), item]);
      setTimeout(() => setItems((list) => list.filter((t) => t.id !== item.id)), item.type === 'err' ? 7000 : 4000);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
