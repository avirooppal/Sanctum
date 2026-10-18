export interface LoopClock {now:()=>number;frame:(fn:FrameRequestCallback)=>number;cancel:(id:number)=>void;later:(fn:()=>void,ms:number)=>number;clear:(id:number)=>void}
const browserClock:LoopClock={now:()=>performance.now(),frame:fn=>requestAnimationFrame(fn),cancel:id=>cancelAnimationFrame(id),later:(fn,ms)=>window.setTimeout(fn,ms),clear:id=>window.clearTimeout(id)};
export function installVideoLoop(video:HTMLVideoElement,clock:LoopClock=browserClock):()=>void{
 let frame:number|undefined,timer:number|undefined,disposed=false,fadingOut=false;
 video.style.opacity='0';
 function fade(to:number){if(frame!==undefined)clock.cancel(frame);const from=Number(video.style.opacity)||0,start=clock.now();const tick=()=>{if(disposed)return;const progress=Math.min(1,Math.max(0,(clock.now()-start)/500));video.style.opacity=String(from+(to-from)*progress);if(progress<1)frame=clock.frame(tick);else frame=undefined;};frame=clock.frame(tick);}
 function play(){if(disposed)return;fadingOut=false;Promise.resolve(video.play()).then(()=>{if(!disposed)fade(1);}).catch(()=>{if(!disposed)video.style.opacity='0';});}
 function time(){if(!fadingOut&&Number.isFinite(video.duration)&&video.duration-video.currentTime<=.55){fadingOut=true;fade(0);}}
 function ended(){if(frame!==undefined)clock.cancel(frame);video.style.opacity='0';if(timer!==undefined)clock.clear(timer);timer=clock.later(()=>{timer=undefined;if(!disposed){video.currentTime=0;play();}},100);}
 video.addEventListener('canplay',play);video.addEventListener('timeupdate',time);video.addEventListener('ended',ended);if(video.readyState>=3)play();
 return ()=>{disposed=true;if(frame!==undefined)clock.cancel(frame);if(timer!==undefined)clock.clear(timer);video.removeEventListener('canplay',play);video.removeEventListener('timeupdate',time);video.removeEventListener('ended',ended);};
}
