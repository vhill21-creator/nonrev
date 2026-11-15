(() => {
 const search=document.getElementById('press-search');
 const year=document.getElementById('press-year');
 const count=document.getElementById('press-count');
 const empty=document.getElementById('press-empty');
 const cards=Array.from(document.querySelectorAll('.press-grid .press-card'));
 if(!search||!year||!count||!empty)return;
 const update=()=>{
   const term=search.value.trim().toLocaleLowerCase(),selected=year.value;let visible=0;
   cards.forEach(card=>{
     const show=(!term||card.textContent.toLocaleLowerCase().includes(term))&&
       (!selected||card.dataset.pressYear===selected);
     card.hidden=!show;if(show)visible++;
   });
   count.textContent=visible+(visible===1?' article':' articles');
   empty.hidden=visible!==0;
 };
 search.addEventListener('input',update);
 year.addEventListener('change',update);
})();
