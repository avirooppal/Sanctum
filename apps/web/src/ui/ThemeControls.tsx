import {useEffect,useState} from 'react';
import {THEMES,themeTokens} from './themes';

export function ThemeControls(){
  const [theme,setTheme]=useState('sanctum');
  const [mode,setMode]=useState<'light'|'dark'|'system'>('system');
  const [systemDark,setSystemDark]=useState(()=>matchMedia('(prefers-color-scheme:dark)').matches);
  useEffect(()=>{
    const preference=matchMedia('(prefers-color-scheme:dark)');
    const changed=()=>setSystemDark(preference.matches);
    preference.addEventListener('change',changed);
    return ()=>preference.removeEventListener('change',changed);
  },[]);
  useEffect(()=>{
    const root=document.documentElement;
    const effective=mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
    for(const [key,value] of Object.entries(themeTokens(theme,effective))) root.style.setProperty(key,value);
    root.dataset.theme=theme;root.dataset.mode=effective;
  },[theme,mode,systemDark]);
  return <div className="ui-theme-controls" aria-label="Appearance">
    <label>Theme<select aria-label="Theme" value={theme} onChange={e=>setTheme(e.target.value)}>
      {THEMES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
    </select></label>
    <label>Mode<select aria-label="Theme mode" value={mode} onChange={e=>setMode(e.target.value as 'light'|'dark'|'system')}>
      <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
    </select></label>
  </div>;
}
