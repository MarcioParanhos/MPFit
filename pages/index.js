import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(()=>{
    let mounted = true;
    (async ()=>{
      try{
        const res = await fetch('/api/auth/me');
        if (!mounted) return;
        if (res.ok) {
          router.replace('/app');
        } else {
          router.replace('/login');
        }
      }catch(e){
        if (!mounted) return;
        router.replace('/login');
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return ()=>{ mounted = false; };
  },[]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="text-lg font-medium">Redirecionando...</div>
      </div>
    </div>
  );
}
