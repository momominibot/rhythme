/* Source-backed chapter navigation. No health inputs are read or inferred. */
(function(){
 'use strict';
 var chapters=window.OVULUNA_CHAPTERS || [], library=document.getElementById('journey-library'), detail=document.getElementById('chapter-detail');
 function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;}
 function art(id,fallback){return window.DREAM_ASSETS && window.DREAM_ASSETS[id] || fallback;}
 function addIcon(parent,chapter){var img=el('img');img.src=art(chapter.id,chapter.icon);img.alt='';img.width=84;img.height=84;img.addEventListener('error',function(){if(img.getAttribute('src')!==chapter.icon)img.src=chapter.icon;});parent.appendChild(img);}
 function evidence(parent,key,title){var button=el('button','qi','i');button.type='button';button.dataset.evidence=key;button.setAttribute('aria-label','Evidence: '+title);parent.appendChild(button);}
 function cards(parent){chapters.forEach(function(c){var a=el('a','journey-link');a.href='journey-'+c.id+'.html';addIcon(a,c);a.appendChild(el('b','',c.title));a.appendChild(el('span','',c.subtitle));parent.appendChild(a);});}
 if(library)cards(library);
 if(detail){
  var id=document.body.dataset.chapter,c=chapters.find(function(item){return item.id===id;});
  if(!c){detail.appendChild(el('p','','This chapter could not load. Please return to the Knowledge Hub.'));return;}
  var hero=el('header','chapter-hero');addIcon(hero,c);hero.appendChild(el('p','journey-eyebrow',c.subtitle));hero.appendChild(el('h1','',c.title));hero.appendChild(el('p','',c.intro));detail.appendChild(hero);
  var nav=el('nav','journey-choices');nav.setAttribute('aria-label','Life stages');chapters.forEach(function(ch){var a=el('a','journey-choice',ch.title);a.href='journey-'+ch.id+'.html';if(ch.id===id)a.setAttribute('aria-current','page');nav.appendChild(a);});detail.appendChild(nav);
  c.sections.forEach(function(s){var section=el('section','chapter-card');evidence(section,s.key,s.title);section.appendChild(el('h2','',s.title));section.appendChild(el('p','',s.text));detail.appendChild(section);});
  if(c.care){var care=el('section','chapter-card chapter-care');evidence(care,c.care.key,'When to seek care');care.appendChild(el('h2','','When to reach for support'));care.appendChild(el('p','',c.care.text));detail.appendChild(care);}
  var links=el('section','chapter-card');links.appendChild(el('h2','','A next step, when you’re ready'));var list=el('div','chapter-links');c.links.forEach(function(link){var a=el('a','',link.label);a.href=link.href;list.appendChild(a);});links.appendChild(list);detail.appendChild(links);
  detail.appendChild(el('p','dream-footer','Sources checked 30 September 2026. Educational guidance, not personal diagnosis. An app source check does not replace clinical review. This chapter is currently in English; translated clinical guidance needs separate review.'));
 }
 document.querySelectorAll('[data-journey-cards]').forEach(cards);
})();
