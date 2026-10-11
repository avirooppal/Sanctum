import {THEME_PRESET_PALETTES,type ThemePresetColors,type ThemePresetPalette} from './palettes.js';
import {ensureContrast,mix,readableOn} from './color.js';

type Mode='light'|'dark';
function classic(dark:boolean):ThemePresetColors {
  const background=dark ? '#1a1a2e' : '#F5F5F5';
  const foreground=dark ? '#FFF8DC' : '#2B2109';
  const sidebar=mix(background,foreground,dark ? .02 : .012);
  const primary=ensureContrast(dark ? '#FFBF00' : '#D89B04',sidebar,4.5);
  const ink=(color:string)=>readableOn(color,['#161616','#ffffff']);
  const border='#CD7F32';const destructive=dark ? '#ef5350' : '#C62828';
  return {background,foreground,card:mix(background,foreground,dark ? .04 : .025),cardForeground:foreground,
    muted:mix(background,foreground,dark ? .06 : .04),mutedForeground:'#B8860B',
    popover:mix(background,foreground,dark ? .08 : .05),popoverForeground:foreground,
    primary,primaryForeground:ink(primary),secondary:mix(primary,background,dark ? .72 : .86),secondaryForeground:foreground,
    accent:mix(primary,background,dark ? .82 : .88),accentForeground:foreground,border,
    input:background,ring:primary,midground:primary,midgroundForeground:ink(primary),composerRing:primary,
    destructive,destructiveForeground:ink(destructive),sidebarBackground:sidebar,sidebarBorder:border,
    userBubble:mix(background,primary,dark ? .18 : .12),userBubbleBorder:border};
}

function dashboard(background:string,foreground:string):ThemePresetPalette {
  return {colors:{background,foreground,card:background,cardForeground:foreground,muted:background,
    mutedForeground:foreground,popover:background,popoverForeground:foreground,primary:foreground,
    primaryForeground:background,secondary:background,secondaryForeground:foreground,accent:background,
    accentForeground:foreground,border:mix(background,foreground,.20),input:background,ring:foreground,
    destructive:'#c43010',destructiveForeground:'#ffffff',sidebarBackground:background}};
}

const palettes:Record<string,ThemePresetPalette>={...THEME_PRESET_PALETTES,
  classic:{colors:classic(false),darkColors:classic(true)},
  teal:dashboard('#041c1c','#ffe6cb'),'teal-large':dashboard('#041c1c','#ffe6cb'),
  rose:dashboard('#1a0f15','#ffd4e1'),'cream-blue':dashboard('#E8F2FD','#0053FD')};
const labels:Record<string,string>={sanctum:'Sanctum',github:'GitHub',catppuccin:'Catppuccin',everforest:'Everforest',
  solarized:'Solarized','sanctum-blue':'Sanctum Blue',classic:'Classic',midnight:'Midnight',ember:'Ember',mono:'Mono',
  slate:'Slate',cyberpunk:'Cyberpunk',teal:'Teal','teal-large':'Teal Large',rose:'Rosé','cream-blue':'Cream Blue'};
export const THEMES=Object.freeze(Object.keys(palettes).map(id=>Object.freeze({id,label:labels[id]})));

export function themeTokens(id:string,mode:Mode):Record<string,string> {
  if (!Object.hasOwn(palettes,id)) throw Error('Unknown UI theme');
  if (mode !== 'light' && mode !== 'dark') throw Error('Unknown UI mode');
  const palette=palettes[id];const c=mode === 'dark' ? palette.darkColors ?? palette.colors : palette.colors;
  const secondary=ensureContrast(mix(c.foreground,c.background,.15),c.background,4.5);
  const tertiary=ensureContrast(mix(c.foreground,c.background,.25),c.background,4.5);
  const disabled=ensureContrast(mix(c.foreground,c.background,.30),c.background,4.5);
  return {'--ui-background':c.background,'--ui-surface':c.card,'--ui-sidebar':c.sidebarBackground ?? c.card,
    '--ui-border':c.border,'--ui-accent':c.primary,'--ui-input':c.input,
    '--ui-text-primary':c.foreground,'--ui-text-secondary':secondary,'--ui-text-tertiary':tertiary,
    '--ui-text-disabled':disabled,'--ui-text-on-accent':c.primaryForeground,
    '--ui-user-bubble':c.userBubble ?? c.secondary,'--ui-focus':c.composerRing ?? c.ring,
    '--ui-base-size':id === 'teal-large' ? '18px' : '15px'};
}
