/* Separate imported legacy records from freshly checked clinical content. */
(function(){
 'use strict';
 var db=window.EVIDENCE_DB || {};
 [window.RECONCILED_EVIDENCE,window.LIFECYCLE_EVIDENCE,window.ACUPOINT_EVIDENCE,window.SAFETY_EVIDENCE,window.CORE_EVIDENCE,window.DAILY_EVIDENCE].forEach(function(entries){if(entries)Object.keys(entries).forEach(function(key){db[key]=entries[key];});});
 window.EVIDENCE_DB=db;
 // Older icon forms now use the same accessible dialog as all reviewed entries.
 document.querySelectorAll('[data-ev],[data-id].evidence-dot').forEach(function(node){var key=node.getAttribute('data-ev') || node.getAttribute('data-id');node.setAttribute('data-evidence',key);node.classList.add('qi');});
 document.querySelectorAll('[data-evidence]').forEach(function(node){var entry=db[node.dataset.evidence];if(!entry || !entry.verification || entry.verification.status!=='verified'){node.dataset.sourceReview='pending';node.setAttribute('title','Source record needs review. Open details for limitations.');}});
 // Make older, unreviewed references visible before a reader relies on the page.
 var pending=document.querySelector('[data-source-review="pending"]'),content=document.querySelector('main,.scroll');
 if(pending && content && !document.getElementById('source-review-note')) {
   var note=document.createElement('aside');note.id='source-review-note';note.className='evidence-route-note';
   note.textContent='This page includes guidance whose sources need further review. Confirm personal care with a qualified clinician. ';
   var link=document.createElement('a');link.href='evidence-library.html';link.textContent='View source status and limitations';note.appendChild(link);content.prepend(note);
 }
})();
