import {useEffect,useId,useRef} from 'react';
import {useReducedMotion} from 'framer-motion';
import {installVideoLoop} from './video-loop';

/* Empty until supplied footage has verified redistribution rights. No remote fallback. */
const bundledClips:Readonly<Record<string,string>>={};
export function Scene({name,hero=false}:{name:string;hero?:boolean}){
 const id=useId().replaceAll(':','');const video=useRef<HTMLVideoElement>(null);const reduced=useReducedMotion();const src=bundledClips[name];
 useEffect(()=>{if(!video.current||reduced||!src)return;return hero?installVideoLoop(video.current):undefined;},[hero,reduced,src]);
 return <div className={`scene scene-${name}`} aria-hidden="true">
  <svg viewBox="0 0 1200 720" preserveAspectRatio="xMidYMid slice"><defs>
   <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#111"/><stop offset=".3" stopColor="#888"/><stop offset=".47" stopColor="#f8f4e8"/><stop offset=".52" stopColor="#393836"/><stop offset=".76" stopColor="#a4a3a0"/><stop offset="1" stopColor="#090909"/></linearGradient>
   <radialGradient id={`${id}-light`}><stop stopColor="#b5b1a4" stopOpacity=".16"/><stop offset="1" stopColor="#000" stopOpacity="0"/></radialGradient>
  </defs><rect width="1200" height="720" fill="#030303"/><ellipse cx="600" cy="360" rx="600" ry="360" fill={`url(#${id}-light)`}/>
  {name==='hero'||name==='approach'?<g transform={name==='hero'?'translate(600 750) rotate(-16)':'translate(600 370) rotate(-24)'}>{Array.from({length:30},(_,i)=><ellipse key={i} rx={340-i*3.5} ry={210-i*3} cy={i*2.5} fill="none" stroke={`url(#${id}-metal)`} strokeWidth={i%5===0?5:1.7}/>)}<ellipse rx="236" ry="120" fill="#020202"/></g>:name==='vision'?<g transform="translate(600 360) rotate(-28)">{Array.from({length:16},(_,i)=><rect key={i} x={-240+i*12} y={-240+i*12} width={480-i*24} height={480-i*24} rx="40" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="8"/>)}</g>:<g transform={`translate(600 360) rotate(${name==='knowledge'?-20:35})`}>{Array.from({length:24},(_,i)=><path key={i} d={`M ${-380+i*9} -220 C 260 -310,-260 310,${380-i*9} 220`} fill="none" stroke={`url(#${id}-metal)`} strokeWidth="5"/>)}</g>}
  </svg>
  {src&&!reduced&&<video ref={video} src={src} muted autoPlay playsInline loop={!hero} preload="auto" style={hero?{opacity:0}:undefined}/>}
 </div>;
}
