# Public landing v2

Route /website.html. Public,unauthenticated,same-origin assets only.
Five design sections:hero,About,featured approach,philosophy,two capability cards.
Existing setup/FAQ/support/journey tables remain truthful and accessible.
Hero primary link opens /. Secondary links target bundled /docs.html or real
section IDs. No email collection,signup,remote social links or fake download.
Instrument Serif is bundled. Supplied clips remain rights-blocked,not fetched.

Video-loop adapter:canplay starts playback and RAF opacity0->1 in500ms;
timeupdate with remaining<=.55 starts one500ms fade-out;ended waits100ms,
resets time,plays and fades in. A new fade cancels the previous RAF;unmount
removes listeners/cancels frames/timers;play rejection leaves static artwork.
Reduced motion does not start playback. No CSS opacity transition on video.
Test IDs:landing-loop-fade,landing-loop-cleanup,public-website-v2.
