/* Rhythme plaza rooms and room chat (docs/design/2026-10-22-plaza-rooms-and-live-channel.md; Jamie, 22 Oct: "can this be
 * a live chat? they still can toggle the channel and chitchat and we will show how many are online at the moment so they
 * can tab around to see what others are chatting").
 * The Channel tab shows every plaza group with how many are there now, and, while she stands in the plaza in one of
 * them, its rooms (Chat, Wins, Vent, Doctor visits, ...) with how many joined each. Tapping a room shows its latest
 * messages read-only; joining is one tap; with Room chat on she can write. Every room carries the help card and a short
 * room note; doctor rooms carry the visit card. The server decides everything (supabase/migrations/20261022120000_plaza_
 * rooms_chat.sql): who may read, write, how long messages live, which ones wait for a person to read them first, and in
 * which mode the rooms run ('review': every message is read first; a live mode needs its own migration). The phone only asks and
 * shows. Until that migration is applied the server answers that the calls do not exist, and nothing of this appears.
 * Pure rules first (tested in node by tools/test-core.js), then the room wiring. */
(function (root) {
  'use strict';
  var FEED_MS = 4000, ROOMS_MS = 10000, GROUPS_MS = 20000, TIMEOUT = 10000, MAX = 280, SHOWN = 40;

  /* ---------- words and rules ---------- */
  /* each group's door sign (generated clay art, 22 Oct); a group the phone does not know gets the plain icon */
  var DOORS = { everyone: 1, pcos: 1, 'trying-to-conceive': 1, 'after-a-loss': 1, 'new-mothers': 1, menopause: 1 };
  function doorImg(id) { return DOORS[id] ? 'assets/room/dream/door-' + id + '.webp' : null; }
  var KIND_ICON = { chat: 'forum', wins: 'celebration', vent: 'air', doctor: 'stethoscope', topic: 'tag', quiet: 'spa' };
  function kindIcon(k) { return KIND_ICON[k] || 'forum'; }
  /* pinned in every room: world-wide, never one country's numbers */
  var HELP = 'If you might hurt yourself or you are in danger, call your local emergency number or go to the nearest emergency department. findahelpline.com lists free helplines in your country.';
  /* a short note at the top of each room: what it is for. Fixed words, labelled as a room note, never a person */
  var NOTES = {
    chat: 'Peer support, not medical advice. Say what you hear before any suggestion, and ask before offering ideas.',
    topic: 'Peer support, not medical advice. Say what you hear before any suggestion, and ask before offering ideas.',
    wins: 'Cheer each other on. Every win counts here, however small.',
    vent: 'Let it out. No fixing needed: listen first, and ask before offering ideas.',
    doctor: 'Share what happened to you, not instructions for anyone else. Your own doctor knows your history.',
    quiet: 'This room is for loss. No pregnancy or birth news, no advice, no fixing. Just company.'
  };
  var DOCTOR = 'Before you go: write down your three questions, what you have tried, and how it affects your days. If you feel dismissed, you can say: “What else could this be?”, “Please note in my record that I asked about this.” or “Can I see someone else for a second opinion?”';
  /* under a shown message whose own words matched the crisis list (the server decides; nothing about the writer's profile) */
  var REMINDER = 'Automatic reminder: if you or anyone here might be in danger, call your local emergency number now, or find a helpline at findahelpline.com.';
  var MODE = {
    review: 'Messages show after a person on the Rhythme team has read them, so they can take a while to appear.',
    live: 'Messages show straight away. Nobody watches the rooms around the clock, so report anything worrying.'
  };
  /* the consent words for the purpose `plaza_chat` (design note section 3, after the Codex design review); a hash of
     them travels with the event, so a change of words needs a new notice */
  var WORDS = 'What you type in a room is shown with your plaza name and look to the people in that group, including anyone who joins while it is still there. Messages can be read for 24 hours and are deleted within an hour after that. Some messages wait for a person on the Rhythme team to read them before they show, and staff also read any message someone reports; a reported message is kept with the report until it is decided (at most 90 days), then for a year. Do not share your real name, where you live or contact details. Rooms are peer support, not medical advice, and nobody watches them around the clock. You can turn this off at any time; your messages are then deleted.';
  var REASONS = [['unkind', 'Unkind or upsetting'], ['advice', 'Unsafe health advice'], ['news', 'Pregnancy or birth news in a quiet room'], ['spam', 'Spam or selling something'],
    ['pretending', 'Pretending to be someone else'], ['under18', 'Seems to be under 18'], ['worried', 'I’m worried about her safety'], ['other', 'Something else']];
  var PROBLEMS = {
    empty: 'Write something first.',
    long: 'Keep it to 280 characters.',
    link: 'Links and web addresses cannot be shared in the rooms. If you did not mean one, add a space after the full stop.',
    contact: 'Contact details, handles and private chat apps cannot be shared here. Keep the talk in the room.',
    word: 'That word is not allowed in the rooms.'
  };
  var WHY = {
    signin: 'Sign in from You to join the rooms.',
    card: 'Make a plaza card in Plaza friends to read and talk in the rooms.',
    hidden: 'Your plaza card is hidden. Show it in Plaza friends to read the rooms.',
    paused: 'Plaza friends is paused on this account for now, so the rooms are too.',
    adult: 'The rooms are for adults 18 and over.',
    notice: 'Turn on Room chat first.',
    not_here: 'You are no longer in this group. Walk back into the plaza to rejoin.',
    not_in_room: 'Join the room first.',
    closed: 'This room is closed for now.',
    same: 'You just said that.',
    fast: 'One moment between messages, please.',
    hour: 'That is a lot of messages this hour. Take a breather and come back.',
    day: 'That is the most for today. The rooms will be here tomorrow.',
    stale: 'Something changed since this opened. Please try again.',
    consent: 'Tick the box to turn on Room chat.',
    gone: 'That message is no longer there.',
    reason: 'Choose a reason.',
    today: 'That is the most reports for today. Thank you for looking after the plaza.',
    off: 'Plaza friends is off on this account.'
  };
  function whyText(j) { var w = j && j.why; if (w === 'text') return PROBLEMS[j.problem] || PROBLEMS.word; return WHY[w] || 'That did not go through. Please try again.'; }

  /* the same rules the server keeps (plaza.text_problem); the core suite checks both against one list of cases */
  var LINK = /(https?:|www\.|[a-z0-9-]+\.[a-z]{2,}\/[a-z0-9])/;
  /* every top-level domain of three or more letters (IANA list, 23 Oct 2026; the migration has the same string): a name
     before one of these, in any case, is a web address; a two-letter (country) ending counts after three or more
     letters, so a missed space ("it.in my back") stays a sentence (Codex diff review round 5, A10) */
  var TLDS = ' aaa aarp abb abbott abbvie abc able abogado abudhabi academy accenture accountant accountants aco actor ads adult aeg aero aetna afl africa agakhan agency aig airbus airforce airtel akdn alibaba alipay allfinanz allstate ally alsace alstom amazon americanexpress americanfamily amex amfam amica amsterdam analytics android anquan anz aol apartments app apple aquarelle arab aramco archi army arpa art arte asda asia associates athleta attorney auction audi audible audio auspost author auto autos aws axa azure baby baidu banamex band bank bar barcelona barclaycard barclays barefoot bargains baseball basketball bauhaus bayern bbc bbt bbva bcg bcn beats beauty beer berlin best bestbuy bet bharti bible bid bike bing bingo bio biz black blackfriday blockbuster blog bloomberg blue bms bmw bnpparibas boats boehringer bofa bom bond boo book booking bosch bostik boston bot boutique box bradesco bridgestone broadway broker brother brussels build builders business buy buzz bzh cab cafe cal call calvinklein cam camera camp canon capetown capital capitalone car caravan cards care career careers cars casa case cash casino cat catering catholic cba cbn cbre center ceo cern cfa cfd chanel channel charity chase chat cheap chintai christmas chrome church cipriani circle cisco citadel citi citic city claims cleaning click clinic clinique clothing cloud club clubmed coach codes coffee college cologne com commbank community company compare computer comsec condos construction consulting contact contractors cooking cool coop corsica country coupon coupons courses cpa credit creditcard creditunion cricket crown crs cruise cruises cuisinella cymru cyou dad dance data date dating datsun day dclk dds deal dealer deals degree delivery dell deloitte delta democrat dental dentist desi design dev dhl diamonds diet digital direct directory discount discover dish diy dnp docs doctor dog domains dot download drive dtv dubai dupont durban dvag dvr earth eat eco edeka edu education email emerck energy engineer engineering enterprises epson equipment ericsson erni esq estate eurovision eus events exchange expert exposed express extraspace fage fail fairwinds faith family fan fans farm farmers fashion fast fedex feedback ferrari ferrero fidelity fido film final finance financial fire firestone firmdale fish fishing fit fitness flickr flights flir florist flowers fly foo food football ford forex forsale forum foundation fox free fresenius frl frogans frontier ftr fujitsu fun fund furniture futbol fyi gal gallery gallo gallup game games gap garden gay gbiz gdn gea gent genting george ggee gift gifts gives giving glass gle global globo gmail gmbh gmo gmx godaddy gold goldpoint golf goodyear goog google gop got gov grainger graphics gratis green gripe grocery group gucci guge guide guitars guru hair hamburg hangout haus hbo hdfc hdfcbank health healthcare help helsinki here hermes hiphop hisamitsu hitachi hiv hkt hockey holdings holiday homedepot homegoods homes homesense honda horse hospital host hosting hot hotels hotmail house how hsbc hughes hyatt hyundai ibm icbc ice icu ieee ifm ikano imamat imdb immo immobilien inc industries infiniti info ing ink institute insurance insure int international intuit investments ipiranga irish ismaili ist istanbul itau itv jaguar java jcb jeep jetzt jewelry jio jll jmp jnj jobs joburg jot joy jpmorgan jprs juegos kaufen kddi kerryhotels kerryproperties kfh kia kids kim kindle kitchen kiwi koeln komatsu kosher kpmg kpn krd kred kuokgroup kyoto lacaixa lamborghini lamer land landrover lanxess lasalle lat latino latrobe law lawyer lds lease leclerc lefrak legal lego lexus lgbt lidl life lifeinsurance lifestyle lighting like lilly limited limo lincoln link live living llc llp loan loans locker locus lol london lotte lotto love lpl lplfinancial ltd ltda lundbeck luxe luxury madrid maif maison makeup man management mango map market marketing markets marriott marshalls mattel mba mckinsey med media meet melbourne meme memorial men menu merck merckmsd miami microsoft mil mini mint mit mitsubishi mlb mls mma mobi mobile moda moe moi mom monash money monster mormon mortgage moscow moto motorcycles mov movie msd mtn mtr museum music nab nagoya name navy nba nec net netbank netflix network neustar new news next nextdirect nexus nfl ngo nhk nico nike nikon ninja nissan nissay nokia norton now nowruz nowtv nra nrw ntt nyc obi observer office okinawa olayan olayangroup ollo omega one ong onl online ooo open oracle orange org organic origins osaka otsuka ott ovh page panasonic paris pars partners parts party pay pccw pet pfizer pharmacy phd philips phone photo photography photos physio pics pictet pictures pid pin ping pink pioneer pizza place play playstation plumbing plus pnc pohl poker politie porn post praxi press prime pro prod productions prof progressive promo properties property protection pru prudential pub pwc qpon quebec quest racing radio read realestate realtor realty recipes red redumbrella rehab reise reisen reit reliance ren rent rentals repair report republican rest restaurant review reviews rexroth rich richardli ricoh ril rio rip rocks rodeo rogers room rsvp rugby ruhr run rwe ryukyu saarland safe safety sakura sale salon samsclub samsung sandvik sandvikcoromant sanofi sap sarl sas save saxo sbi sbs scb schaeffler schmidt scholarships school schule schwarz science scot search seat secure security seek select sener services seven sew sex sexy sfr shangrila sharp shell shia shiksha shoes shop shopping shouji show silk sina singles site ski skin sky skype sling smart smile sncf soccer social softbank software sohu solar solutions song sony soy spa space sport spot srl stada staples star statebank statefarm stc stcgroup stockholm storage store stream studio study style sucks supplies supply support surf surgery suzuki swatch swiss sydney systems tab taipei talk taobao target tatamotors tatar tattoo tax taxi tci tdk team tech technology tel temasek tennis teva thd theater theatre tiaa tickets tienda tips tires tirol tjmaxx tjx tkmaxx tmall today tokyo tools top toray toshiba total tours town toyota toys trade trading training travel travelers travelersinsurance trust trv tube tui tunes tushu tvs ubank ubs unicom university uno uol ups vacations vana vanguard vegas ventures verisign versicherung vet viajes video vig viking villas vin vip virgin visa vision viva vivo vlaanderen vodka volvo vote voting voto voyage wales walmart walter wang wanggou watch watches weather weatherchannel web webcam weber website wed wedding weibo weir whoswho wien wiki williamhill win windows wine winners wme woodside work works world wow wtc wtf xbox xerox xihuan xin xxx xyz yachts yahoo yamaxun yandex yodobashi yoga yokohama you youtube yun zappos zara zero zip zone zuerich ';
  var MSG_WORDS = { cunt: 'word', whore: 'word', slut: 'word', nudes: 'word', onlyfans: 'word', porn: 'word', nazi: 'word', hitler: 'word',
    telegram: 'contact', whatsapp: 'contact', kik: 'contact', wechat: 'contact', discord: 'contact', snapchat: 'contact' };
  function squash(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').replace(/^ | $/g, ''); }
  function straight(s) { return s.toLowerCase().replace(/[’‘]/g, "'"); }
  /* the one help address the help card names is set aside exactly: its own host, nothing before it and no further label
     after it (findahelpline.com.evil.scot stays an address; Codex round 5, B3) */
  var HELPLINE = /(^|[^a-z0-9.@_-])(https?:\/\/)?(www\.)?findahelpline\.com(\/[a-z0-9\/_-]*)?(?=$|[^a-z0-9@_.-]|\.(?:$|[^a-z0-9]))/gi,
    PHONE7 = /(^|[^0-9])[0-9]{3}[ .-][0-9]{4}($|[^0-9])/,
    /* contact grammar ("call me on", "my number is", or a bare "call", "text") with a number of five digits or more
       right after it, at most one word between ("after the phone call I managed 10000 steps" is not one; round 6) */
    ASK = /\b(?:(?:call|text|ring|phone|whatsapp|sms|msg|message|reach|contact|email|e-mail|telegram|wechat|signal|line|add|find) me|my (?:phone number|number|no|phone|hp|handphone|mobile|cell|contact|whatsapp|telegram|wechat|line|insta|ig|email|e-mail|handle|id)|call|text|ring|dial|sms|whatsapp|phone)\b[^0-9a-z+]*(?:[a-z']+[^0-9a-z+]+)?(\+?[0-9][0-9 ().-]*[0-9])/g,
    /* a date (2026-10-22, 23.10.2026) is never part of a phone number, so dates go before digits are counted (round 5) */
    DATES = /(?<![0-9.])([0-9]{4}[-.](0?[1-9]|1[0-2])[-.](0?[1-9]|[12][0-9]|3[01])|(0?[1-9]|[12][0-9]|3[01])[-.](0?[1-9]|1[0-2])[-.]([0-9]{4}|[0-9]{2}))(?![0-9])/g;
  function hostIn(t) {
    return t.split(/[^A-Za-z0-9.-]+/).some(function (tok) {
      var parts = tok.replace(/^[.-]+|[.-]+$/g, '').split('.');
      for (var i = 1; i < parts.length; i++) {
        var tld = parts[i].toLowerCase(), prev = parts[i - 1];
        if (!/^[a-z]{2,24}$/.test(tld) || !/^[A-Za-z0-9-]+$/.test(prev)) continue;
        if (tld.length === 2 ? prev.length >= 3 : ((prev.length >= 2 || !/^[ia]$/i.test(prev)) && TLDS.indexOf(' ' + tld + ' ') > -1)) return true; /* x.com counts; "I.love" stays prose (round 6) */
      }
      return false;
    });
  }
  function digitRuns(low) { return (low.match(/\+?[0-9][0-9 ().-]*[0-9]/g) || []).map(function (r) { return r.replace(/[^0-9]/g, '').length; }); }
  function textProblem(s) {
    var t = squash(s); if (!t) return 'empty';
    if (Array.from(t).length > MAX) return 'long';
    var low = straight(t);
    /* contact details first, on all of her words, so no exception can hide one */
    if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(low) || /(^|[^a-z0-9])@[a-z0-9_.]{2,}/.test(low)) return 'contact';
    /* a number with a country code is a phone number whatever its digits look like (+45 20-12-2012; round 6), but a plus
       right after a digit is a pregnancy week (12+3), not a country code (round 7) */
    if ((low.match(/(?<![0-9])\+[0-9][0-9 ().-]*[0-9]/g) || []).some(function (r) { return r.replace(/[^0-9]/g, '').length >= 7; })) return 'contact';
    var nd = low.replace(DATES, ' '), m;
    if (digitRuns(nd).some(function (n) { return n >= 8; }) || PHONE7.test(nd)) return 'contact';
    ASK.lastIndex = 0;
    while ((m = ASK.exec(nd))) if (m[1].replace(/[^0-9]/g, '').length >= 5) return 'contact';
    if (/\b(dm|pm|message|add) me\b/.test(low) || /\bmy (number|handle|ig|insta) is\b/.test(low)) return 'contact';
    var bare = t.replace(HELPLINE, '$1 ');
    if (LINK.test(straight(bare)) || hostIn(bare)) return 'link';
    var toks = low.split(/[^a-z0-9]+/);
    for (var k = 0; k < toks.length; k++) if (toks[k] && Object.prototype.hasOwnProperty.call(MSG_WORDS, toks[k])) return MSG_WORDS[toks[k]];
    return null;
  }
  /* the phrases that make the server hold a message for a person to read first (plaza_hold_phrases); the phone says why
     before she sends. The core suite checks these lists equal the migration's. */
  var HOLD = {
    care: ['kill myself', 'killing myself', 'end it all', 'end my life', 'take my life', 'suicide', 'suicidal', 'want to die', 'wanna die', "don't want to be here",
      'dont want to be here', 'do not want to be here', "don't want to live", 'dont want to live', 'hurt myself', 'harm myself', 'self harm', 'cutting myself',
      'overdose', 'no reason to live', 'better off without me', 'hurt my baby', 'harm my baby'],
    advice: ['stop your', 'stop taking your', 'come off your', 'double your', 'double the dose', 'instead of your doctor', "don't listen to your doctor",
      'dont listen to your doctor', 'no need for a doctor', "don't take your", 'dont take your', 'skip your', 'cures pcos', 'cure for', 'buy it from'],
    /* a medicine named next to take, stop, start, buy... (a dose or a schedule holds on its own) */
    med: ['ibuprofen', 'paracetamol', 'acetaminophen', 'panadol', 'aspirin', 'naproxen', 'mefenamic', 'ponstan', 'tranexamic', 'codeine', 'tramadol', 'metformin',
      'letrozole', 'clomid', 'clomiphene', 'progesterone', 'estrogen', 'oestrogen', 'estradiol', 'oestradiol', 'testosterone', 'hrt', 'inositol', 'spironolactone',
      'vitex', 'berberine', 'semaglutide', 'ozempic', 'wegovy', 'tirzepatide', 'mounjaro', 'sertraline', 'fluoxetine', 'antidepressant', 'antidepressants',
      'the pill', 'supplement', 'supplements', 'pills', 'tablets', 'painkillers', 'insulin', 'antibiotic', 'antibiotics', 'medication', 'medications',
      'medicine', 'medicines', 'meds', 'drug', 'drugs', 'dose', 'doses', 'steroid', 'steroids', 'birth control', 'contraceptive', 'contraceptives', 'hormones',
      'vitamin', 'vitamins', 'melatonin', 'magnesium', 'folic acid', 'ashwagandha', 'cbd', 'antihistamine', 'antihistamines', 'laxative', 'laxatives',
      'prednisone', 'levothyroxine', 'misoprostol', 'mifepristone'],
    /* everyday kindness that opens like an instruction, and clears that sentence */
    ok: ['take care', 'take it easy', 'take your time', 'take a break', 'take a breath', 'take a deep breath', 'take a nap', 'take a rest', 'take a moment',
      'take a minute', 'take it slow', 'take it one day at a time', 'take each day as it comes', 'take care of yourself', 'try to rest', 'try to sleep',
      'try to relax', 'try again', 'try your best', 'stop blaming yourself', 'stop being so hard on yourself', 'start small', 'take it personally', 'stop trying'],
    news: ["i'm pregnant", 'im pregnant', 'i am pregnant', "we're pregnant", 'we are pregnant', "i'm expecting", 'i am expecting', "we're expecting", 'we are expecting',
      'bfp', 'big fat positive', 'got my positive', "it's a girl", "it's a boy", 'its a girl', 'its a boy', 'gender reveal', 'pregnancy announcement',
      'birth announcement', 'baby is here']
  };
  function flat(s) { return ' ' + straight(String(s == null ? '' : s)).replace(/[^a-z0-9']+/g, ' ').replace(/\s+/g, ' ').trim() + ' '; }
  function hasPhrase(f, list) { return list.some(function (p) { return f.indexOf(' ' + p.replace(/-/g, ' ') + ' ') > -1; }); }
  var DOSE = / [0-9]+ ?(mg|mcg|iu|ml|g|tablets?|pills?|capsules?|caps|drops?|puffs?|units?) /, EVERY = / every [0-9]+ ?(hours?|hrs?|h|days?) /,
    TIMES = / ([0-9]+|once|twice|three|four) times? (a|per) day /, TIMES2 = / (once|twice) (a|per) day /,
    ACT = / (take|taking|start|starting|stop|stopping|try|use|double|increase|up|skip|quit|buy|swap|switch|avoid|reduce|lower|halve|drop|cut|add) /;
  /* a sentence that tells someone to take, stop, start or try something, whatever it is called (the server's rule), clause
     by clause: what leads in ("honestly", "you should", "the nurse said you could") is set aside, a "don't" or "never" too,
     and an everyday kindness clears its clause only when it is the whole clause (Codex diff review round 4, A7) */
  var LEAD = /^ ((i think|honestly|so|and|but|just|please|maybe|definitely|really|seriously|i would|i d|you (should|must|need to|have to|could|can|might want to|gotta|ought to)) )+/,
    YOU = /^.*? you (should|must|need to|have to|gotta|ought to|could|can|might want to) /,
    NEG = /^ (don't|dont|do not|never) /,
    DIRECT = /^ (take|stop|start|quit|skip|double|halve|increase|decrease|reduce|lower|switch|swap|avoid|try|use|buy|come off|go off|get off) [a-z0-9]/,
    OK_TAIL = /^ ((today|tonight|now|please|ok|okay|x|xx|xxx|love|lovely|dear|hun|hon|mama|ladies|everyone|all|friend|friends|sis|babe|girl|girls|too) )*$/;
  function okClause(c) { return HOLD.ok.some(function (p) { var pre = ' ' + p + ' '; return c.indexOf(pre) === 0 && OK_TAIL.test(c.slice(pre.length - 1)); }); }
  function directive(s) {
    return straight(String(s == null ? '' : s)).split(/[.!?;:,\n]+/).some(function (cl) {
      var c = flat(cl).replace(LEAD, ' ').replace(YOU, ' ').replace(NEG, ' ');
      return DIRECT.test(c) && !okClause(c);
    });
  }
  function holdWhy(s, noNews) {
    var f = flat(s);
    if (hasPhrase(f, HOLD.care)) return 'care';
    if (hasPhrase(f, HOLD.advice) || DOSE.test(f) || EVERY.test(f) || TIMES.test(f) || TIMES2.test(f) || (hasPhrase(f, HOLD.med) && ACT.test(f)) || directive(s)) return 'advice';
    if (noNews && hasPhrase(f, HOLD.news)) return 'news';
    return null;
  }
  /* counts as a person would say them: a room counts who joined it; anyone in the group may also read */
  function roomCount(r) {
    if (!r) return '';
    if (r.open === false) return 'Closed for now';
    var n = Math.max(0, Number(r.people) || 0), cap = Math.max(1, Number(r.capacity) || 12);
    return n >= cap ? cap + ' of ' + cap + ' joined, full' : n === 0 ? 'Nobody joined yet' : n + ' joined';
  }
  function hereNow(n) { n = Math.max(0, Number(n) || 0); return n === 0 ? 'Nobody here now' : n + ' here now'; }
  function ago(iso, now) {
    var t = Date.parse(iso), s = Math.max(0, Math.round(((now || Date.now()) - t) / 1000));
    if (!isFinite(t)) return '';
    return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : Math.floor(s / 3600) + ' h ago';
  }
  function lastText(iso, now) { return iso ? 'Last message ' + ago(iso, now) : 'Quiet today'; }
  /* the full-room line: which rooms in the group have space */
  function fullText(j) {
    var names = ((j && j.suggest) || []).map(function (s) { return s.name; }).filter(Boolean);
    var lead = (j && j.name ? j.name : 'That room') + ' is full right now.';
    if (!names.length) return lead + ' Try again in a little while.';
    return lead + ' ' + (names.length === 1 ? names[0] + ' has' : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] + ' have') + ' space.';
  }
  /* the feed as she sees it: the server's latest visible ids decide what stays (hidden, blocked, withdrawn or expired
     messages leave), new rows are added in order, and people she muted on this phone are left out */
  function mergeFeed(have, reply, muted) {
    var keep = {}, by = {}, mute = muted || [];
    ((reply && reply.ids) || []).forEach(function (id) { keep[String(id)] = true; });
    (have || []).forEach(function (m) { if (keep[String(m.id)]) by[String(m.id)] = m; });
    ((reply && reply.messages) || []).forEach(function (m) { if (m && keep[String(m.id)]) by[String(m.id)] = m; });
    return Object.keys(by).map(function (k) { return by[k]; }).filter(function (m) { return m.mine || mute.indexOf(m.handle) < 0; })
      .sort(function (a, b) { return Number(a.id) - Number(b.id); }).slice(-SHOWN);
  }
  var X = { TLDS: TLDS, FEED_MS: FEED_MS, ROOMS_MS: ROOMS_MS, GROUPS_MS: GROUPS_MS, TIMEOUT: TIMEOUT, MAX: MAX, DOORS: DOORS, KIND_ICON: KIND_ICON, HELP: HELP, NOTES: NOTES,
    DOCTOR: DOCTOR, REMINDER: REMINDER, MODE: MODE, WORDS: WORDS, REASONS: REASONS, PROBLEMS: PROBLEMS, WHY: WHY, HOLD: HOLD, MSG_WORDS: MSG_WORDS,
    doorImg: doorImg, kindIcon: kindIcon, whyText: whyText, textProblem: textProblem, holdWhy: holdWhy, flat: flat, roomCount: roomCount, hereNow: hereNow,
    ago: ago, lastText: lastText, fullText: fullText, mergeFeed: mergeFeed };
  root.OvuRooms = X;

  /* ---------- the room ---------- */
  var R = root.OvuRoom, A = root.OvuAuth, S = root.OvuStore, doc = root.document, CFG = root.OVU_CONFIG || {};
  if (!R || !A || !S || !doc || !doc.createElement) return;

  /* `missing`: the server answered that the rooms do not exist (its migration is not applied): nothing of the rooms shows
   * and nothing is asked again until the app is opened afresh. `broken`: an answer that is not what this phone expects;
   * the same, so an old feed never lingers. */
  var missing = false, broken = false, seen = false, probing = null, lastUid = null, wordsHash = '';
  var groups = null, rooms = null, view = null, feed = null, drafts = {}, busy = {}, gens = { groups: 0, rooms: 0, feed: 0 }, els = { groups: null, rooms: null };
  var timers = [], stick = false, joinBusy = false, joinWant = null, chatGen = 0, menuOpen = null;
  /* the newest Room chat event this phone has seen on this account, from an On, an Off or the rooms list: an older answer
     never turns chat back on or off (Codex diff review round 4, B1) */
  var chatKnown = null, DAY = 24 * 3600 * 1000;

  function esc(s) { return R.esc ? R.esc(s) : String(s == null ? '' : s); }
  function noop() { }
  function uid() { var s = A.session && A.session(); return s && s.user ? s.user.id : null; }
  function inPlaza() { var L = R.layout && R.layout(); return !!(L && L.id === 'plaza'); }
  function visit() { var P = root.OvuPlaza, st = P && P.state ? P.state() : null; return st && st.joined && st.joined.visit ? { server: st.joined.id, visit: st.joined.visit, name: st.joined.name } : null; }
  function shown() { var T = root.OvuToday; return !!(T && T.tab && T.tab() === 'channel' && els.rooms && doc.body && doc.body.contains(els.rooms)); }
  /* the rooms are for adults: a phone marked under 18 on its old age question never asks for them, whatever the account
     holds on the server (the Plaza friends rule) */
  function minor() {
    try { if (root.OvuConsent && root.OvuConsent.legacyMinor) return !!root.OvuConsent.legacyMinor(); } catch (e) { return true; }
    return ['under13', '13-16', '13-17', '17'].indexOf((S.profile() || {}).ageBand || '') > -1;
  }
  function allowed() { return !!uid() && !minor(); }
  function active() { return allowed() && !doc.hidden && !missing && !broken && shown(); }
  function device() { try { return root.OvuConsent && root.OvuConsent.device ? root.OvuConsent.device() : ''; } catch (e) { return ''; } }
  function noticeV() { return (root.OvuConsent && root.OvuConsent.NOTICE_V) || 3; }
  (function hashWords() {
    try { root.crypto.subtle.digest('SHA-256', new root.TextEncoder().encode('Room chat. ' + WORDS)).then(function (h) { wordsHash = Array.prototype.map.call(new Uint8Array(h), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }, noop); } catch (e) { }
  })();
  function mutedList() { var m = S.state().roomsMuted; return m && m.uid === uid() && Array.isArray(m.handles) ? m.handles : []; }
  function unmuted(rows) { var mute = mutedList(); return rows.filter(function (m) { return m.mine || mute.indexOf(m.handle) < 0; }); }
  function setRows(rows) { feed.rows = rows; feed.msgs = unmuted(rows); }
  /* a fresh look after something she did changed the window (Off, Block, a message sent): replies already on their way
     are dropped, and the next look asks for the whole window */
  function refetch() { gens.feed++; busy.feed = false; if (feed) feed.seen = null; return loadFeed(); }
  /* the shapes this phone draws; anything else is a malformed answer and the rooms hide */
  function okGroup(x) { return !!x && typeof x === 'object' && typeof x.id === 'string' && typeof x.name === 'string'; }
  function okRoom(x) { return !!x && typeof x === 'object' && typeof x.id === 'string' && typeof x.name === 'string'; }
  function okMsg(x) { return !!x && typeof x === 'object' && (typeof x.id === 'number' || (typeof x.id === 'string' && /^[0-9]+$/.test(x.id))) && typeof x.body === 'string'; }
  /* her entry for this room only: what the latest look at the room said, else the rooms list */
  function entryFor(room) {
    var v = visit(); if (!room || !v) return null;
    if (feed && feed.room === room && feed.visit === v.visit) return feed.joined ? feed.entry : null;
    return rooms && rooms.room === room && typeof rooms.entry === 'string' ? rooms.entry : null;
  }
  /* reading stopped (signed out, card gone or hidden, paused, under 18): no messages, no writing, no late replies */
  var DENIED = { signin: 1, card: 1, hidden: 1, paused: 1, adult: 1, off: 1 };
  function closeRoomSheet() { if (doc.getElementById('rmSheet') && R.sheetOpen && R.sheetOpen()) R.closeSheet(); }
  /* the open room goes, with any sheet of the rooms (a report, a care or hold card, Room chat) and any reply still on its way */
  function dropFeed() { view = null; feed = null; gens.feed++; busy.feed = false; closeRoomSheet(); }
  function forget() { chatGen++; joinWant = null; menuOpen = null; if (groups || rooms || view || feed) { groups = null; rooms = null; dropFeed(); gens.groups++; gens.rooms++; busy = {}; paint(); } }
  /* Plaza friends off, the age answer withdrawn, Room chat off on another phone (the consent hook in ovu-consent.js): what
     she sees and anything still on its way go at once, here, not at the next refused look (Codex round 4, B2) */
  function standDown(purpose) {
    if (purpose === 'plaza_chat') {
      chatGen++; if (rooms) rooms.talk = false;
      if (feed) { setRows(feed.rows.filter(function (m) { return !m.mine; })); refetch(); }
      paint(); return;
    }
    forget(); lastKick = 0; kick();
  }
  /* messages last 24 hours: past that they leave this phone too, even when the rooms cannot be reached (Codex round 4, B8) */
  function prune() {
    if (!feed) return;
    var now = Date.now(), keep = feed.rows.filter(function (m) { var t = Date.parse(m.at); return !(t && now - t >= DAY); });
    if (keep.length === feed.rows.length) return;
    setRows(keep); feed.seen = null; gens.feed++; busy.feed = false; /* a look on its way described the window before: dropped (round 5, 1) */
    if (menuOpen && !keep.some(function (x) { return String(x.id) === menuOpen.id; })) { closeMine(menuOpen.sh); menuOpen = null; }
    paint();
  }
  /* Room chat as the newest event says: an answer naming an older event than one already seen changes nothing */
  function chatNews(u, ev) { return ev != null && (!chatKnown || chatKnown.uid !== u || Number(ev) > chatKnown.event); }
  /* an answer is out of date when a newer event is known, or this very event is known with the other state */
  function chatOld(u, ev, talk) { return ev != null && !!chatKnown && chatKnown.uid === u && (Number(ev) < chatKnown.event || (Number(ev) === chatKnown.event && chatKnown.talk !== !!talk)); }
  function chatSeen(u, ev, talk) { if (ev != null && (!chatKnown || chatKnown.uid !== u || Number(ev) >= chatKnown.event)) chatKnown = { uid: u, event: Number(ev), talk: !!talk }; }

  /* one request for one account, with one deadline; cancelled if another account is signed in before it leaves or when
     its reply comes back (the Plaza friends pattern) */
  function cancelled() { var e = new Error('cancelled'); e.cancelled = true; return e; }
  function rpc(name, args, owner) {
    if (owner === undefined) owner = uid();
    var ctl = root.AbortController ? new root.AbortController() : null;
    var call = Promise.resolve().then(function () { if (!owner || uid() !== owner) throw cancelled(); return A.token(); }).then(function (t) {
      if (!t) throw new Error('signed out');
      if (uid() !== owner) throw cancelled();
      return root.fetch(CFG.supabaseUrl + '/rest/v1/rpc/' + name, {
        method: 'POST', signal: ctl ? ctl.signal : undefined,
        headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(args || {})
      }).then(function (r) { return r.text().then(function (x) { var j = null; try { j = x ? JSON.parse(x) : null; } catch (e) { } if (!r.ok) { var er = new Error((j && j.message) || ('error ' + r.status)); if (r.status === 404 && j && j.code === 'PGRST202') er.missing = true; throw er; } return j; }); });
    });
    return new Promise(function (resolve, reject) {
      var timer = root.setTimeout(function () { if (ctl) ctl.abort(); reject(new Error('timeout')); }, TIMEOUT);
      call.then(function (j) { root.clearTimeout(timer); if (uid() !== owner) reject(cancelled()); else resolve(j); }, function (e) { root.clearTimeout(timer); reject(e); });
    });
  }
  function failed(e) {
    if (e && e.cancelled) return;
    prune();
    if (e && e.missing) { missing = true; groups = groups; rooms = null; view = null; feed = null; stop(); }
    paint();
  }
  function malformed() { broken = true; rooms = null; dropFeed(); gens.rooms++; busy.rooms = false; stop(); try { paint(); } catch (e) { } }

  /* ---------- three polls, each with one request in flight ---------- */
  function loadGroups() {
    if (busy.groups || !allowed() || doc.hidden) return Promise.resolve();
    var u = uid(), g = ++gens.groups; busy.groups = true;
    return rpc('plaza_list', {}, u).then(function (j) {
      if (g !== gens.groups || uid() !== u || minor()) return;
      groups = j && Array.isArray(j.servers) ? j.servers.filter(okGroup) : null; paint();
    }, failedQuiet).catch(malformed).then(function () { if (g === gens.groups) busy.groups = false; });
  }
  function failedQuiet(e) { if (e && e.cancelled) return; paint(); }
  function loadRooms() {
    var v = visit(), u = uid();
    if (!v || !allowed() || missing || broken || !inPlaza()) { if (rooms || view || feed) { rooms = null; dropFeed(); paint(); } return Promise.resolve(); }
    if (busy.rooms) return Promise.resolve();
    var g = ++gens.rooms; busy.rooms = true;
    return rpc('plaza_rooms_list', { p_server: v.server, p_visit: v.visit }, u).then(function (j) {
      var now = visit();
      if (g !== gens.rooms || uid() !== u || !now || now.visit !== v.visit || minor()) return;
      if (!j || typeof j.ok !== 'boolean') { malformed(); return; }
      seen = true;
      if (!j.ok) { rooms = null; dropFeed(); paint(); return; }
      if (!Array.isArray(j.rooms) || !j.rooms.every(okRoom)) { malformed(); return; }
      if (chatKnown && chatKnown.uid === u && (j.chat_event == null || Number(j.chat_event) < chatKnown.event)) { j.talk = chatKnown.talk && j.read; j.chat_event = chatKnown.event; }
      else if (j.read) {
        var offNow = !j.talk && chatNews(u, j.chat_event) && !!chatKnown && chatKnown.uid === u && chatKnown.talk;
        chatSeen(u, j.chat_event, j.talk);
        if (offNow) { chatGen++; if (feed) { setRows(feed.rows.filter(function (m) { return !m.mine; })); refetch(); } }
      }
      rooms = j;
      if (view && (!j.read || !j.rooms.some(function (r) { return r.id === view; }))) dropFeed();
      paint();
    }, failed).catch(malformed).then(function () { if (g === gens.rooms) busy.rooms = false; });
  }
  function loadFeed() {
    var v = visit(), u = uid(), room = view;
    if (!v || !allowed() || !room || !rooms || !rooms.read) return Promise.resolve();
    if (busy.feed) return Promise.resolve();
    /* she sends the fingerprint of the window she has: the server answers `same` with no rows, or the whole window as it is now */
    var g = ++gens.feed, had = feed && feed.room === room && feed.visit === v.visit ? feed : null, seen = had && had.seen ? had.seen : null; busy.feed = true;
    return rpc('plaza_room_feed', { p_server: v.server, p_visit: v.visit, p_room: room, p_seen: seen }, u).then(function (j) {
      var now = visit();
      if (g !== gens.feed || uid() !== u || view !== room || !now || now.visit !== v.visit || minor()) return;
      if (!j || typeof j.ok !== 'boolean') { malformed(); return; }
      if (!j.ok) {
        if (DENIED[j.why]) { dropFeed(); if (rooms) { rooms.read = false; rooms.why = j.why; rooms.room = null; rooms.entry = null; rooms.talk = false; } }
        else if (j.why === 'not_here' || j.why === 'closed') { dropFeed(); loadRooms(); }
        else if (feed) feed.why = j.why;
        paint(); return;
      }
      if (!Array.isArray(j.ids) || !Array.isArray(j.messages) || !j.messages.every(okMsg) || typeof j.seen !== 'string' || (j.entry != null && typeof j.entry !== 'string')) { malformed(); return; }
      var same = j.same === true && !!had && had.seen === j.seen, rows = same ? had.rows : mergeFeed([], j, []);
      if (!same && rows.length !== Math.min(j.ids.length, SHOWN)) { malformed(); return; } /* one snapshot on the server: every id has its row */
      if (menuOpen && (menuOpen.room !== room || !rows.some(function (x) { return String(x.id) === menuOpen.id; }))) { closeMine(menuOpen.sh); menuOpen = null; }
      feed = { room: room, visit: v.visit, rows: rows, msgs: unmuted(rows), seen: j.seen, joined: !!j.joined && !!j.entry, entry: j.joined && j.entry ? j.entry : null,
        people: j.people, capacity: j.capacity, open: j.open !== false, mode: j.mode === 'live' ? 'live' : 'review' };
      paint();
    }, failed).catch(malformed).then(function () { if (g === gens.feed) busy.feed = false; });
  }
  function tick(which) {
    if (uid() !== lastUid) { authChanged(); return; }
    if (minor()) { forget(); return; }
    if (which === 'feed') prune();
    if (!active()) return;
    if (which === 'groups') loadGroups(); else if (which === 'rooms') loadRooms(); else loadFeed();
  }
  function start() {
    stop(); if (missing || broken) return;
    timers = [root.setInterval(function () { tick('groups'); }, GROUPS_MS), root.setInterval(function () { tick('rooms'); }, ROOMS_MS), root.setInterval(function () { tick('feed'); }, FEED_MS)];
  }
  function stop() { timers.forEach(function (t) { root.clearInterval(t); }); timers = []; }
  /* once per session: do the rooms exist on the server at all (the call answers 'not_here' without a group)? Plaza
     friends and the plaza sheet use this to offer Room chat off and to describe the rooms, even away from the plaza */
  function probe() {
    var u = uid(); if (seen || missing || broken || !allowed()) return Promise.resolve();
    if (probing) return probing;
    probing = rpc('plaza_rooms_list', { p_server: null, p_visit: null }, u).then(function (j) { if (uid() !== u) return; if (j && typeof j.ok === 'boolean') { seen = true; paint(); } else malformed(); }, failed).catch(malformed).then(function () { probing = null; });
    return probing;
  }
  /* the tab was shown, or she came back: ask now rather than wait for the next tick */
  var lastKick = 0;
  function kick() {
    if (!active() || Date.now() - lastKick < 1500) return;
    lastKick = Date.now();
    if (!timers.length) start();
    loadGroups(); probe().then(function () { return loadRooms(); }).then(function () { if (view) loadFeed(); }); /* a missing server is asked once */
  }
  /* any change of account, in this tab or another: cancel, forget, close, then start again for whoever is signed in */
  function authChanged() {
    var u = uid(); if (u === lastUid) return; lastUid = u;
    gens.groups++; gens.rooms++; gens.feed++; busy = {}; joinWant = null; menuOpen = null; chatKnown = null; chatGen++;
    groups = null; rooms = null; view = null; feed = null; drafts = {}; seen = false;
    if (doc.getElementById('rmSheet') && R.sheetOpen && R.sheetOpen()) R.closeSheet();
    var box = els.rooms && els.rooms.querySelector('.rmcompose textarea'); if (box) box.value = '';
    paint(); if (u) kick();
  }

  /* ---------- drawing (in place: the box she types in is never replaced while she types) ---------- */
  function door(id, cls) {
    var src = doorImg(id);
    return src ? '<img class="' + (cls || 'rmdoor') + '" src="' + esc(src) + '" alt="" loading="lazy">' : '<span class="ms ' + (cls || 'rmdoor') + '" aria-hidden="true">' + esc((root.OvuPlaza && root.OvuPlaza.icon) ? root.OvuPlaza.icon(id) : 'groups') + '</span>';
  }
  function paintGroups() {
    var el = els.groups; if (!el) return;
    if (!uid() || minor() || !groups || !groups.length) { el.removeAttribute('data-key'); el.innerHTML = ''; el.hidden = true; return; }
    var v = visit(), here = inPlaza();
    var key = JSON.stringify([groups, v && v.server, here]);
    if (el.getAttribute('data-key') === key) return;
    el.setAttribute('data-key', key); el.hidden = false;
    el.innerHTML = '<div class="rmgroups" role="list" aria-label="Plaza groups and how many are there now">' + groups.map(function (s) {
      var mine = !!v && v.server === s.id, full = !mine && (s.open === false || Number(s.people) >= Number(s.capacity));
      var inner = door(s.id) + '<b>' + esc(s.name) + '</b><small>' + (mine ? 'You are here · ' : '') + esc(s.open === false ? 'Closed' : full ? 'Full' : hereNow(s.people)) + '</small>';
      var label = s.name + ', ' + (s.open === false ? 'closed' : hereNow(s.people)) + (mine ? ', your group' : '');
      return here && !mine && !full ? '<button type="button" role="listitem" class="rmgroup" data-rmgroup="' + esc(s.id) + '" aria-label="' + esc('Join ' + label) + '">' + inner + '</button>'
        : '<div role="listitem" class="rmgroup' + (mine ? ' mine' : '') + (full ? ' full' : '') + '" aria-label="' + esc(label) + '">' + inner + '</div>';
    }).join('') + '</div>' + (here ? '' : '<p class="rmhint">Walk to the plaza to join a group and its rooms.</p>');
  }
  function roomById(id) { return rooms && rooms.rooms ? rooms.rooms.filter(function (r) { return r.id === id; })[0] || null : null; }
  function paintRooms() {
    var el = els.rooms; if (!el) return;
    var v = visit();
    if (missing || broken || !uid() || minor() || !v || !inPlaza() || !rooms || rooms.why === 'adult') { if (el.getAttribute('data-state') !== 'off') { el.setAttribute('data-state', 'off'); el.innerHTML = ''; } el.hidden = true; return; }
    el.hidden = false;
    if (!view) {
      var key = JSON.stringify([rooms.rooms, rooms.read, rooms.why, rooms.room, rooms.mode, rooms.chat_on]);
      if (el.getAttribute('data-state') === 'list' && el.getAttribute('data-key') === key) { el.querySelectorAll('[data-ago]').forEach(function (n) { n.textContent = lastText(n.getAttribute('data-ago') || null); }); return; }
      el.setAttribute('data-state', 'list'); el.setAttribute('data-key', key);
      var h = '<h3 class="rmhead">Rooms in ' + esc(v.name || 'your group') + '</h3>';
      if (!rooms.read) h += '<div class="rmwhy"><span class="ms" aria-hidden="true">badge</span><p>' + esc(WHY[rooms.why] || WHY.card) + '</p>' + (rooms.why === 'card' || rooms.why === 'hidden' ? '<button type="button" class="btn soft" data-rmact="friends"><span class="ms" aria-hidden="true">diversity_1</span>Plaza friends</button>' : '') + '</div>';
      if (rooms.chat_on === false) h += '<p class="rmhint">The rooms are closed for now.</p>';
      h += '<ul class="rmlist">' + rooms.rooms.map(function (r) {
        var mine = rooms.room === r.id;
        return '<li><button type="button" class="rmrow' + (mine ? ' mine' : '') + '" data-rmroom="' + esc(r.id) + '"' + (rooms.read ? '' : ' disabled') + ' aria-label="' + esc(r.name + '. ' + r.blurb + '. ' + roomCount(r) + (mine ? '. You joined' : '')) + '">' +
          '<span class="ms" aria-hidden="true">' + esc(kindIcon(r.kind)) + '</span><span class="rn"><b>' + esc(r.name) + (mine ? ' <i>joined</i>' : '') + '</b><small>' + esc(r.blurb) + '</small></span>' +
          '<span class="rc"><b>' + esc(roomCount(r)) + '</b><small data-ago="' + esc(r.last_at || '') + '">' + esc(lastText(r.last_at)) + '</small></span></button></li>';
      }).join('') + '</ul><p class="rmhint">Everyone in the group can read the rooms; a count says who joined to talk. ' + esc(MODE[rooms.mode] || MODE.review) + '</p>';
      el.innerHTML = h; return;
    }
    var r = roomById(view); if (!r) { dropFeed(); paintRooms(); return; }
    var f = feed && feed.room === view && feed.visit === v.visit ? feed : null, joined = !!entryFor(view);
    if (el.getAttribute('data-state') !== 'room:' + view) {
      el.setAttribute('data-state', 'room:' + view); el.removeAttribute('data-key');
      el.innerHTML = '<div class="rmtop"><button type="button" class="btn ghost rmback" data-rmact="back"><span class="ms" aria-hidden="true">arrow_back</span>Rooms</button><div class="rmtitle"><span class="ms" aria-hidden="true">' + esc(kindIcon(r.kind)) + '</span><b>' + esc(r.name) + '</b><small class="rmcount"></small></div></div>' +
        '<div class="rmhelp" role="note"><span class="ms" aria-hidden="true">health_and_safety</span><p>' + esc(HELP) + '</p><a class="btn soft" href="https://findahelpline.com" target="_blank" rel="noopener"><span class="ms" aria-hidden="true">call</span>Find a helpline</a></div>' +
        '<div class="rmnote" role="note"><span class="lbl">Room note</span><p>' + esc(NOTES[r.kind] || NOTES.chat) + '</p></div>' +
        (r.kind === 'doctor' ? '<div class="rmnote rmdoc" role="note"><span class="lbl">Getting ready for a visit</span><p>' + esc(DOCTOR) + '</p></div>' : '') +
        '<ol class="rmmsgs" aria-live="polite" aria-label="Messages in ' + esc(r.name) + '"></ol><p class="rmempty" hidden>No messages in the last 24 hours. Say hello.</p>' +
        '<div class="rmjoin"></div><div class="rmcompose" hidden><label class="sr-only" for="rmText">Message to ' + esc(r.name) + '</label><textarea id="rmText" rows="2" maxlength="' + MAX + '" placeholder="Say something kind, or say how it is"></textarea>' +
        '<div class="rmsend"><small class="rmleft"></small><button type="button" class="btn primary" data-rmact="send"><span class="ms" aria-hidden="true">send</span>Send</button></div><p class="rmmsg" role="status"></p>' +
        '<button type="button" class="btn ghost rmleave" data-rmact="leave"><span class="ms" aria-hidden="true">logout</span>Leave this room</button></div><p class="rmhint rmmode"></p>';
      var box = el.querySelector('#rmText'); box.value = drafts[view] || '';
      box.addEventListener('input', function () { drafts[view] = box.value; left(); });
      left();
    }
    el.querySelector('.rmcount').textContent = roomCount(f ? { people: f.people, capacity: f.capacity, open: f.open } : r);
    el.querySelector('.rmmode').textContent = MODE[(f && f.mode) || rooms.mode] || MODE.review;
    paintMsgs(el.querySelector('.rmmsgs'), f ? f.msgs : []);
    el.querySelector('.rmempty').hidden = !(f && !f.msgs.length);
    var join = el.querySelector('.rmjoin'), comp = el.querySelector('.rmcompose');
    comp.hidden = !joined || (f && !f.open);
    var jh = joined ? '' : (f && !f.open) || r.open === false ? '<p class="rmhint">This room is closed for now.</p>'
      : '<button type="button" class="btn primary" data-rmact="join"><span class="ms" aria-hidden="true">login</span>Join this room</button>' + (rooms.talk ? '' : '<small>Reading is open to everyone in the group. Joining lets you write, once Room chat is on.</small>');
    if (join.getAttribute('data-html') !== jh) { join.setAttribute('data-html', jh); join.innerHTML = jh; }
  }
  function left() { var el = els.rooms, box = el && el.querySelector('#rmText'), n = el && el.querySelector('.rmleft'); if (box && n) { var k = MAX - Array.from(box.value).length; n.textContent = k < 40 ? k + ' left' : ''; } }
  function msgNode(m) {
    var li = doc.createElement('li'); li.className = 'rmm' + (m.mine ? ' mine' : '') + (m.held ? ' held' : ''); li.setAttribute('data-id', String(m.id));
    li.innerHTML = '<img src="' + esc(R.ART + 'avatar-' + (m.look || 'base') + '.webp') + '" alt=""><div class="rmb"><div class="rmw"><b>' + esc(m.mine ? 'You' : m.name || 'Someone') + '</b><small data-at="' + esc(m.at) + '">' + esc(ago(m.at)) + '</small>' +
      (m.mine ? '' : '<button type="button" class="rmmore" data-rmmore="' + esc(String(m.id)) + '" aria-label="' + esc('Report, mute or block ' + (m.name || 'her')) + '"><span class="ms" aria-hidden="true">more_horiz</span></button>') + '</div>' +
      '<p></p>' + (m.held ? '<small class="rmheld"><span class="ms" aria-hidden="true">hourglass_top</span>Waiting for a check. Only you can see it until then.</small>' : '') +
      (m.care ? '<div class="rmcare" role="note"><span class="ms" aria-hidden="true">health_and_safety</span><span>' + esc(REMINDER) + '</span></div>' : '') + '</div>';
    li.querySelector('p').textContent = m.body; /* her words as text, never markup */
    return li;
  }
  function paintMsgs(ol, list) {
    var have = {}; Array.prototype.forEach.call(ol.children, function (li) { have[li.getAttribute('data-id')] = li; });
    var nearBottom = ol.scrollHeight - ol.scrollTop - ol.clientHeight < 40, before = ol.children.length;
    var keep = {};
    list.forEach(function (m, i) {
      var id = String(m.id), li = have[id];
      if (li && li.classList.contains('held') !== !!m.held) { li.remove(); li = null; }
      if (!li) li = msgNode(m);
      keep[id] = true;
      if (ol.children[i] !== li) ol.insertBefore(li, ol.children[i] || null);
      var t = li.querySelector('[data-at]'); if (t) t.textContent = ago(t.getAttribute('data-at'));
    });
    Object.keys(have).forEach(function (id) { if (!keep[id]) have[id].remove(); });
    if (nearBottom || before === 0 || stick) ol.scrollTop = ol.scrollHeight; /* someone reading further up stays where she is */
    stick = false;
  }
  function paint() { paintGroups(); paintRooms(); if (root.OvuToday && root.OvuToday.noteRooms) root.OvuToday.noteRooms(); }

  /* ---------- acting ---------- */
  function openRoom(id) { if (!rooms || !rooms.read || !roomById(id)) return; dropFeed(); view = id; paint(); loadFeed(); }
  function back() { dropFeed(); paint(); loadRooms(); }
  /* joins go one at a time: a tap while one is on its way is asked after it, so an older answer never overrides a newer
     choice (Codex diff review round 3) */
  function join() {
    var v = visit(); if (!v || !allowed() || !view) return;
    joinWant = { uid: uid(), server: v.server, visit: v.visit, room: view };
    if (!joinBusy) joinNext();
  }
  function joinNext() {
    var w = joinWant; joinWant = null;
    if (!w) { joinBusy = false; return; }
    joinBusy = true;
    var room = w.room, u = w.uid;
    rpc('plaza_room_join', { p_server: w.server, p_visit: w.visit, p_room: room }, u).then(function (j) {
      var now = visit();
      if (uid() !== u || !now || now.visit !== w.visit) return;
      if (!j || typeof j.ok !== 'boolean' || (j.ok && typeof j.entry !== 'string')) { malformed(); return; }
      if (joinWant) return; /* a newer choice is on its way: its answer says where she is */
      if (j.ok) {
        /* she is in one room at a time: the room on screen, whichever it is, takes this answer, and looks asked before it
           are dropped (Codex round 4, B6) */
        if (rooms) { rooms.room = room; rooms.entry = j.entry; }
        if (feed && feed.visit === w.visit) { feed.joined = feed.room === room; feed.entry = feed.room === room ? j.entry : null; }
        gens.rooms++; busy.rooms = false;
        paint(); refetch(); loadRooms();
        if (view === room) { if (R.chime) R.chime('tap'); var b = els.rooms && els.rooms.querySelector('#rmText'); if (b) try { b.focus({ preventScroll: true }); } catch (e) { } }
        return;
      }
      if (view === room) R.toast(j.why === 'full' ? fullText(j) : whyText(j), 'forum');
      if (j.why === 'not_here' || DENIED[j.why]) { dropFeed(); paint(); loadRooms(); }
    }, function (e) { if (!(e && e.cancelled)) { failed(e); if (!(e && e.missing) && view === room) R.toast('Could not reach the rooms. Check the connection and try again.', 'cloud_off'); } }).catch(malformed).then(joinNext);
  }
  function leave() {
    var u = uid(), entry = entryFor(view); if (!u || !entry) return;
    rpc('plaza_room_leave', { p_entry: entry }, u).then(function () {
      if (uid() !== u) return;
      if (rooms && rooms.entry === entry) { rooms.room = null; rooms.entry = null; }
      if (feed && feed.entry === entry) { feed.joined = false; feed.entry = null; }
      gens.rooms++; busy.rooms = false;
      paint(); refetch(); loadRooms();
    }, function (e) { if (!(e && e.cancelled)) R.toast('Could not reach the rooms. Check the connection and try again.', 'cloud_off'); });
  }
  function rmSheet(id, title, sub, icon, html) { R.openSheet(id, title, sub, icon, '<div id="rmSheet">' + html + '</div>'); var el = doc.getElementById('rmSheet'); el.__seq = R.sheetSeq ? R.sheetSeq() : null; return el; }
  /* a reply that comes back later closes the sheet it was asked from, never one another feature opened since */
  function closeMine(sh) { if (sh && (R.sheetSeq ? R.sheetSeq() === sh.__seq : doc.body.contains(sh)) && R.sheetOpen && R.sheetOpen()) R.closeSheet(); }
  /* send: her words are checked here first, then her Room chat yes (asked once, just in time), then the care card or the
     hold notice when the words call for it; only then does anything leave the phone */
  function send() {
    var el = els.rooms, box = el && el.querySelector('#rmText'), msg = el && el.querySelector('.rmmsg'); if (!box || !allowed()) return;
    var text = box.value, room = view, r = roomById(room), p = textProblem(text), v = visit();
    if (msg) msg.textContent = '';
    if (p) { if (msg) msg.textContent = PROBLEMS[p]; return; }
    if (!rooms || !rooms.talk) {
      /* a yes that arrives later sends only this message, from this room, still unchanged in the box (Codex round 2, B1) */
      var pend = { uid: uid(), visit: v && v.visit, room: room, text: text, entry: entryFor(room) };
      askChat(function (mine) {
        var b = els.rooms && els.rooms.querySelector('#rmText'), now = visit();
        if (mine && allowed() && uid() === pend.uid && now && now.visit === pend.visit && view === pend.room && entryFor(pend.room) === pend.entry && b && b.value === pend.text) send();
        else R.toast('Room chat is on. Tap Send when you are ready.', 'forum');
      });
      return;
    }
    /* what this message is for, fixed now: the account, the visit, the room and her entry to it. A sheet confirmed later
       sends only if all four still hold (Codex diff review, 22 Oct, item 2) */
    var ctx = { uid: uid(), visit: v && v.visit, room: room, entry: entryFor(room), text: text };
    if (!ctx.visit || !ctx.entry) { if (msg) msg.textContent = WHY.not_in_room; return; }
    var u = root.OvuOrb && root.OvuOrb.urgent ? root.OvuOrb.urgent(text, S.profile()) : null, hw = holdWhy(text, r && r.no_news);
    if ((u && u.level === 'emergency') || hw === 'care') { careFirst(u, ctx); return; }
    if (hw === 'news' || hw === 'advice') { holdFirst(hw, ctx); return; }
    say(ctx, false);
  }
  function still(ctx) { var v = visit(); return allowed() && uid() === ctx.uid && !!v && v.visit === ctx.visit && view === ctx.room && entryFor(ctx.room) === ctx.entry; }
  function say(ctx, hold) {
    var el = els.rooms, msg = el && el.querySelector('.rmmsg'), btn = el && el.querySelector('[data-rmact="send"]');
    if (!still(ctx)) { R.toast(WHY.stale, 'forum'); return; }
    if (btn) btn.disabled = true;
    var cg = chatGen;
    rpc('plaza_say', { p_entry: ctx.entry, p_body: ctx.text, p_hold: !!hold }, ctx.uid).then(function (j) {
      if (uid() !== ctx.uid || chatGen !== cg) return; /* Room chat went off meanwhile: whatever this sent was deleted with the rest */
      if (!j || typeof j.ok !== 'boolean' || (j.ok && j.message != null && !okMsg(j.message))) { malformed(); return; }
      var here = still(ctx);
      if (!j.ok) {
        if (here && msg) msg.textContent = whyText(j); else R.toast(whyText(j), 'forum');
        if (j.why === 'notice' && rooms) rooms.talk = false;
        if (j.why === 'not_in_room' || j.why === 'not_here' || DENIED[j.why]) loadRooms();
        return;
      }
      /* only the words that were sent are cleared: anything she typed while it was on its way stays */
      if (drafts[ctx.room] === ctx.text) drafts[ctx.room] = '';
      var b = here && els.rooms.querySelector('#rmText'); if (b && b.value === ctx.text) { b.value = ''; left(); }
      if (here && feed && feed.room === ctx.room && feed.visit === ctx.visit && j.message) {
        setRows(mergeFeed(feed.rows, { ids: feed.rows.map(function (m) { return m.id; }).concat([j.message.id]), messages: [j.message] }, [])); stick = true; paint();
      }
      if (here) refetch();
      if (j.held) R.toast(j.held_why === 'review' ? 'Sent. It shows once someone on the Rhythme team has read it.' : 'Sent for a check. Only you can see it until someone on the Rhythme team has read it.', 'hourglass_top');
    }, function (e) { if (!(e && e.cancelled)) { failed(e); if (still(ctx) && msg) msg.textContent = 'Could not reach the rooms. Your words are still here; try again.'; } }).catch(malformed).then(function () { if (btn) btn.disabled = false; });
  }
  /* the care card for her own words: the profile-aware card from the diary's rules stays on this phone; she may send it
     for a person to read first, or keep it */
  function careFirst(u, ctx) {
    var care = u && root.OvuOrb && root.OvuOrb.careHTML ? root.OvuOrb.careHTML(u) : '<b>Please look after yourself first</b><p>' + esc(HELP) + '</p><div class="row"><a class="btn primary" href="https://findahelpline.com" target="_blank" rel="noopener"><span class="ms">call</span>Find a helpline</a></div>';
    var sh = rmSheet('roomCare', 'Before it goes', 'Your words matter', 'health_and_safety',
      '<div class="rmcarecard">' + care + '</div><p class="help">The rooms are peer support, and nobody watches them around the clock. If you send this, a person on the Rhythme team reads it before it shows, which can take a while. This is not an emergency service: if you are in danger now, use the help above.</p>' +
      '<div class="row"><button type="button" class="btn primary" id="rmCareSend"><span class="ms" aria-hidden="true">hourglass_top</span>Send it for a check</button><button type="button" class="btn soft" id="rmCareKeep">Keep it here for now</button></div>');
    sh.querySelector('#rmCareSend').addEventListener('click', function () { R.closeSheet(); say(ctx, true); });
    sh.querySelector('#rmCareKeep').addEventListener('click', function () { R.closeSheet(); });
  }
  function holdFirst(kind, ctx) {
    var words = kind === 'news' ? 'This room keeps pregnancy and birth news out, for people who are grieving or still trying. If yours is news like that, Everyone, Wins is the place for it. If it is something else, send it and a person will read it first.'
      : 'Messages about medicines and doses, or that tell someone what to take, stop, start or try, wait for a person to read them first. Sharing what happened to you is still welcome; it may just take longer to show. Your own doctor knows your history.';
    var sh = rmSheet('roomHold', kind === 'news' ? 'A quiet room' : 'A gentle check', 'Before it goes', 'hourglass_top',
      '<p>' + esc(words) + '</p><div class="row"><button type="button" class="btn primary" id="rmHoldSend"><span class="ms" aria-hidden="true">hourglass_top</span>Send it for a check</button><button type="button" class="btn soft" id="rmHoldEdit">Edit it</button></div>');
    sh.querySelector('#rmHoldSend').addEventListener('click', function () { R.closeSheet(); say(ctx, true); });
    sh.querySelector('#rmHoldEdit').addEventListener('click', function () { R.closeSheet(); });
  }
  /* Room chat, asked once at her first message: the form names her card and the last Room chat event the server knew */
  function askChat(then) {
    if (!rooms) return;
    var u = uid(), card = rooms.card, seen = rooms.chat_event == null ? null : rooms.chat_event;
    var sh = rmSheet('roomChat', 'Room chat', 'Writing in the rooms', 'forum',
      '<div class="flag info"><span class="ms">shield_person</span><div><b>Room chat</b><span>' + esc(WORDS) + '</span></div></div>' +
      '<label class="frcheck"><input type="checkbox" id="rmChatOk"> <span>I understand, and I want to write in the rooms</span></label>' +
      '<div class="row"><button type="button" class="btn primary" id="rmChatOn"><span class="ms" aria-hidden="true">forum</span>Turn on Room chat</button><button type="button" class="btn soft" id="rmChatNo">Not now</button></div><p class="msg" id="rmChatMsg" role="status"></p>');
    sh.querySelector('#rmChatNo').addEventListener('click', function () { R.closeSheet(); });
    sh.querySelector('#rmChatOn').addEventListener('click', function () {
      var ok = sh.querySelector('#rmChatOk').checked, m = sh.querySelector('#rmChatMsg');
      if (!allowed() || uid() !== u || !rooms || !rooms.read) { R.closeSheet(); return; }
      if (!ok) { m.textContent = WHY.consent; return; }
      var cg = chatGen;
      rpc('plaza_chat_on', { p_notice: noticeV(), p_hash: wordsHash || null, p_device: device() || null, p_opt_in: true, p_expect: card, p_seen: seen }, u).then(function (j) {
        if (uid() !== u) return;
        if (!j || !j.ok) { m.textContent = whyText(j); if (j && j.why === 'stale') loadRooms(); return; }
        /* an Off since (here, in Plaza friends or on another phone) wins over this older yes: nothing is recorded or said,
           and the rooms list says where things stand (Codex round 4, B1) */
        var ev = j.chat_event != null ? j.chat_event : null;
        if (chatGen !== cg || chatOld(u, ev, true)) { closeMine(sh); gens.rooms++; busy.rooms = false; loadRooms(); return; }
        if (ev != null) chatSeen(u, ev, true);
        try { if ((j.recorded || []).indexOf('plaza_chat') > -1 && root.OvuConsent && root.OvuConsent.grant) root.OvuConsent.grant('plaza_chat', 'jit', { sent: true }); } catch (e) { }
        if (rooms) { rooms.talk = true; if (ev != null) rooms.chat_event = ev; }
        /* the message waiting for this yes goes on only from this sheet: if another one opened since, she taps Send herself
           (Codex round 4, item 4) */
        var mine = R.sheetSeq ? R.sheetSeq() === sh.__seq : true;
        closeMine(sh); R.toast('Room chat is on. You can turn it off in Plaza friends.', 'forum');
        if (then) then(mine);
      }, function (e) { if (!(e && e.cancelled)) m.textContent = 'Could not reach the rooms. Check the connection and try again.'; });
    });
  }
  /* Room chat off (from Plaza friends or here): her messages are deleted at once */
  function chatOff() {
    var u = uid(); if (!u) return Promise.resolve();
    chatGen++; /* a Send or a Room chat yes still on its way says nothing once she has asked for Off */
    return rpc('plaza_chat_off', { p_notice: noticeV(), p_device: device() || null }, u).then(function (j) {
      if (uid() !== u) return;
      if (!j || !j.ok) { refetch(); return; }
      if (chatOld(u, j.chat_event, false)) { gens.rooms++; busy.rooms = false; loadRooms(); return; } /* an On since is newer */
      chatSeen(u, j.chat_event, false);
      try { if (root.OvuConsent && root.OvuConsent.withdraw) root.OvuConsent.withdraw('plaza_chat', 'you', { sent: true }); } catch (e) { }
      chatGen++;
      if (rooms) { rooms.talk = false; if (j.chat_event) rooms.chat_event = j.chat_event; }
      if (feed) { setRows(feed.rows.filter(function (m) { return !m.mine; })); refetch(); }
      paint(); R.toast('Room chat is off. Your messages were deleted.', 'forum');
    });
  }
  function messageMenu(id) {
    var m = feed && feed.msgs.filter(function (x) { return String(x.id) === String(id); })[0]; if (!m || m.mine) return;
    var u = uid(), room0 = feed.room;
    /* every button checks she may still read this room on this account and the message is still there; a refusal, an age
       change or the message leaving the window closes the sheet */
    function still0() {
      if (allowed() && uid() === u && feed && feed.room === room0 && rooms && rooms.read && feed.rows.some(function (x) { return String(x.id) === String(m.id); })) return true;
      closeMine(sh); return false;
    }
    var sh = rmSheet('roomMsg', m.name || 'A message', 'Report, mute or block', 'flag',
      '<blockquote class="rmquote"></blockquote><p class="frcue"><span class="ms" aria-hidden="true">spa</span>Thank you for looking after the plaza.</p>' +
      '<fieldset class="rmreasons"><legend>What is wrong?</legend>' + REASONS.map(function (x, i) { return '<label><input type="radio" name="rmReason" value="' + x[0] + '"' + (i ? '' : ' checked') + '> ' + esc(x[1]) + '</label>'; }).join('') + '</fieldset>' +
      '<label class="frcheck"><input type="checkbox" id="rmAlsoBlock"> <span>Also block her (neither of you sees the other)</span></label>' +
      '<div class="row"><button type="button" class="btn primary" id="rmReport"><span class="ms" aria-hidden="true">flag</span>Report</button></div>' +
      '<div class="row"><button type="button" class="btn soft" id="rmMute"><span class="ms" aria-hidden="true">volume_off</span>Mute her on this phone</button><button type="button" class="btn soft" id="rmBlock"><span class="ms" aria-hidden="true">block</span>Block</button></div><p class="msg" id="rmMenuMsg" role="status"></p>');
    sh.querySelector('.rmquote').textContent = m.body;
    menuOpen = { id: String(m.id), room: room0, sh: sh };
    var say_ = function (t) { sh.querySelector('#rmMenuMsg').textContent = t; };
    sh.querySelector('#rmReport').addEventListener('click', function () {
      if (!still0()) return;
      var reason = (sh.querySelector('input[name="rmReason"]:checked') || {}).value, blk = sh.querySelector('#rmAlsoBlock').checked;
      rpc('plaza_report_message', { p_message: Number(m.id), p_reason: reason, p_block: blk }, u).then(function (j) {
        if (uid() !== u) return;
        if (!j || !j.ok) { say_(whyText(j)); return; }
        closeMine(sh); R.toast('Reported. Thank you for looking after the plaza.', 'flag');
        if (blk && feed) { setRows(feed.rows.filter(function (x) { return x.mine || x.handle !== m.handle; })); paint(); refetch(); } else loadFeed();
      }, function (e) { if (!(e && e.cancelled)) say_('Could not reach the rooms. Check the connection and try again.'); });
    });
    sh.querySelector('#rmMute').addEventListener('click', function () {
      if (!still0()) return;
      var list = mutedList().slice(); if (list.indexOf(m.handle) < 0) list.push(m.handle);
      S.setState({ roomsMuted: { uid: u, handles: list.slice(-200) } });
      if (feed) setRows(feed.rows);
      R.closeSheet(); paint(); R.toast('Muted on this phone. She is not told.', 'volume_off');
    });
    sh.querySelector('#rmBlock').addEventListener('click', function () {
      if (!still0()) return;
      rpc('social_block', { p_handle: m.handle }, u).then(function (j) {
        if (uid() !== u) return;
        if (j && j.ok === false) { say_(whyText(j)); return; }
        closeMine(sh); R.toast('Blocked. She is not told.', 'block'); if (feed) setRows(feed.rows.filter(function (x) { return x.mine || x.handle !== m.handle; })); paint(); refetch();
      }, function (e) { if (!(e && e.cancelled)) say_('Could not reach the rooms. Check the connection and try again.'); });
    });
  }

  /* ---------- the Channel tab hands its two places over (ovu-today.js) ---------- */
  function attach(groupsEl, roomsEl) {
    var fresh = els.rooms !== roomsEl;
    els.groups = groupsEl; els.rooms = roomsEl;
    if (fresh) {
      roomsEl.addEventListener('click', function (e) {
        var b = e.target.closest('[data-rmroom],[data-rmact],[data-rmmore]'); if (!b || b.disabled) return;
        if (R.chime) R.chime('tap');
        if (b.dataset.rmroom) openRoom(b.dataset.rmroom);
        else if (b.dataset.rmmore) messageMenu(b.dataset.rmmore);
        else ({ back: back, join: join, leave: leave, send: send, friends: function () { if (root.OvuFriends && root.OvuFriends.open) root.OvuFriends.open(); } }[b.dataset.rmact] || noop)();
      });
      roomsEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.target.id === 'rmText') { e.preventDefault(); send(); } });
      groupsEl.addEventListener('click', function (e) {
        var b = e.target.closest('[data-rmgroup]'); if (!b || !root.OvuPlaza || !root.OvuPlaza.join) return;
        if (R.chime) R.chime('tap');
        dropFeed(); rooms = null; paint(); root.OvuPlaza.join(b.dataset.rmgroup);
      });
    }
    paint(); kick();
  }
  function mount() {
    lastUid = uid();
    if (A.subscribe) A.subscribe(authChanged);
    root.addEventListener('storage', function (e) { if (e.key === null || e.key === 'ovumind_auth_v1') authChanged(); }); /* another tab signed in or out */
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) stop(); else { if (uid() !== lastUid) authChanged(); prune(); kick(); } });
    R.on('consent', function (purpose, action) { if (action === 'withdraw' && (purpose === 'social' || purpose === 'age_18' || purpose === 'plaza_chat')) standDown(purpose); });
    if (root.OvuPlaza && root.OvuPlaza.onChange) {
      var lastVisit = null;
      root.OvuPlaza.onChange(function () {
        var v = visit(), key = v ? v.visit : null;
        if (key !== lastVisit) { lastVisit = key; gens.rooms++; busy.rooms = false; rooms = null; dropFeed(); paint(); if (key) kick(); }
        else paintGroups();
      });
    }
    R.on('layout', function () { paint(); if (inPlaza()) kick(); });
    start();
  }
  R.on('boot', mount);
  X.attach = attach; X.kick = kick; X.chatOff = chatOff; X.openRoom = openRoom; X.probe = probe; /* Plaza friends asks before it draws its Room chat row */
  X.available = function () { return !missing && !broken && seen && !minor(); };
  X.state = function () { return { missing: missing, broken: broken, groups: groups ? groups.slice() : null, rooms: rooms, view: view, feed: feed ? { room: feed.room, joined: feed.joined, entry: feed.entry, msgs: feed.msgs.slice(), seen: feed.seen, mode: feed.mode } : null, timers: timers.length }; };
  X.poll = function () { lastKick = 0; return Promise.all([loadGroups(), loadRooms()]).then(function () { return loadFeed(); }); }; /* what the timers do, for the smoke suite */
})(typeof window !== 'undefined' ? window : this);
