import {useEffect,useState} from 'react';
import {THEMES,themeTokens} from './themes';

type Selection={theme:string;mode:'light'|'dark'|'system'};
export function ThemeControls({value,onChange}:{value?:Selection;onChange?:(next:Partial<Selection>)=>void}={}){
  const [localTheme,setTheme]=useState('sanctum');
  const [localMode,setMode]=useState<'light'|'dark'|'system'>('system');
  const theme=value?.theme??localTheme,mode=value?.mode??localMode;
  const [systemDark,setSystemDark]=useState(()=>matchMedia('(prefers-color-scheme:dark)').matches);
  useEffect(()=>{
    if(value)return;
    const preference=matchMedia('(prefers-color-scheme:dark)');
    const changed=()=>setSystemDark(preference.matches);
    preference.addEventListener('change',changed);
    return ()=>preference.removeEventListener('change',changed);
  },[]);
  useEffect(()=>{
    if(value)return;
    const root=document.documentElement;
    const effective=mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
    for(const [key,value] of Object.entries(themeTokens(theme,effective))) root.style.setProperty(key,value);
    root.dataset.theme=theme;root.dataset.mode=effective;
  },[theme,mode,systemDark,value]);
  return <div className="ui-theme-controls" aria-label="Appearance">
    <label>Theme<select aria-label="Theme" value={theme} onChange={e=>onChange?onChange({theme:e.target.value}):setTheme(e.target.value)}>
      {THEMES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
    </select></label>
    <label>Mode<select aria-label="Theme mode" value={mode} onChange={e=>onChange?onChange({mode:e.target.value as Selection['mode']}):setMode(e.target.value as Selection['mode'])}>
      <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
    </select></label>
  </div>;
}
