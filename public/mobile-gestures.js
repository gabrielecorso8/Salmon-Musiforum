// Prevent page magnification and the top-edge rubber band without blocking inner scrolling.
for(const type of ['gesturestart','gesturechange'])document.addEventListener(type,event=>{if(event.cancelable)event.preventDefault()},{passive:false});
let startX=0,startY=0;
document.addEventListener('touchstart',event=>{if(event.touches.length===1){startX=event.touches[0].clientX;startY=event.touches[0].clientY}},{passive:true});
document.addEventListener('touchmove',event=>{
  if(event.touches.length>1){if(event.cancelable)event.preventDefault();return}
  if(event.touches.length!==1||window.scrollY>0)return;
  const dx=event.touches[0].clientX-startX,dy=event.touches[0].clientY-startY;
  if(dy<=0||Math.abs(dx)>=Math.abs(dy))return;
  // A nested list, editor or dialog with content above should still scroll normally.
  let el=event.target instanceof Element?event.target:null;
  while(el&&el!==document.body){
    const style=getComputedStyle(el);
    if(/auto|scroll/.test(style.overflowY)&&el.scrollHeight>el.clientHeight&&el.scrollTop>0)return;
    el=el.parentElement;
  }
  if(event.cancelable)event.preventDefault();
},{passive:false});
