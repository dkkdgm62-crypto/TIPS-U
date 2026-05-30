// ═══════════════════════════════════════════════════
// FE12 · SPIELE / MATCHES  (separate Datei)
// ═══════════════════════════════════════════════════
var matchesData = [];
var matchPlayersData = {};
var selMatch = null;
var matchView = 'list';

var SPIEL_TYPEN = [
  {key:'meisterschaft', label:'Meisterschaftsspiel', color:'#22c55e'},
  {key:'testspiel', label:'Testspiel', color:'#3b82f6'},
  {key:'rasenturnier', label:'Rasen-Turnier', color:'#f59e0b'},
  {key:'hallenturnier', label:'Hallen-Turnier', color:'#a855f7'},
  {key:'intensivwoche', label:'Intensivwoche', color:'#ef4444'}
];
function typInfo(k){ return SPIEL_TYPEN.find(function(t){return t.key===k;}) || SPIEL_TYPEN[0]; }

async function loadMatches(){
  try {
    var r = await sb.from('matches').select('*').order('datum',{ascending:false});
    matchesData = r.data || [];
    var r2 = await sb.from('match_players').select('*');
    matchPlayersData = {};
    (r2.data||[]).forEach(function(mp){
      if(!matchPlayersData[mp.match_id]) matchPlayersData[mp.match_id] = {};
      matchPlayersData[mp.match_id][mp.player_id] = {dabei:mp.dabei, note:mp.note, kommentar:mp.kommentar||''};
    });
  } catch(e){ console.error('loadMatches', e); }
}

async function createMatch(){
  var r = await sb.from('matches').insert({typ:'testspiel', gegner:'', datum:new Date().toISOString().slice(0,10), ort:''}).select();
  if(r.data && r.data[0]){
    await loadMatches();
    selMatch = r.data[0].id;
    matchView = 'detail';
    if(typeof logActivity==='function') logActivity(0,'match','Neues Spiel angelegt',null,null,'match','','Testspiel');
    renderSpiele();
  }
}

function saveMatch(id, field, val, oldVal){
  var m = matchesData.find(function(x){return x.id===id;});
  if(m) m[field] = val;
  debSave('match_'+id+'_'+field, async function(){
    var upd = {}; upd[field] = val;
    await sb.from('matches').update(upd).eq('id', id);
    var label = m ? (typInfo(m.typ).label+' vs '+(m.gegner||'?')) : '';
    if(typeof logActivity==='function') logActivity(0,'match', label+' · '+field+': '+val, null,null,field,oldVal,val);
  });
}

async function deleteMatch(id){
  if(!confirm('Dieses Spiel wirklich löschen?')) return;
  await sb.from('matches').delete().eq('id', id);
  if(typeof logActivity==='function') logActivity(0,'match','Spiel gelöscht',null,null,'delete',null,null);
  selMatch = null; matchView = 'list';
  await loadMatches(); renderSpiele();
}

function toggleMatchPlayer(matchId, pid){
  if(!matchPlayersData[matchId]) matchPlayersData[matchId] = {};
  var cur = matchPlayersData[matchId][pid];
  if(cur){ cur.dabei = !cur.dabei; }
  else { matchPlayersData[matchId][pid] = {dabei:true, note:null, kommentar:''}; }
  var d = matchPlayersData[matchId][pid];
  sb.from('match_players').upsert({match_id:matchId, player_id:pid, dabei:d.dabei, note:d.note, kommentar:d.kommentar},{onConflict:'match_id,player_id'});
  if(typeof logActivity==='function') logActivity(pid,'match','Aufgebot: '+(d.dabei?'dabei':'nicht dabei'),null,null,'dabei',null,d.dabei?'dabei':'raus');
  renderMatchDetail();
}

function setMatchPlayerField(matchId, pid, field, val){
  if(!matchPlayersData[matchId]) matchPlayersData[matchId] = {};
  if(!matchPlayersData[matchId][pid]) matchPlayersData[matchId][pid] = {dabei:true, note:null, kommentar:''};
  matchPlayersData[matchId][pid][field] = val;
  var d = matchPlayersData[matchId][pid];
  debSave('mp_'+matchId+'_'+pid+'_'+field, function(){
    sb.from('match_players').upsert({match_id:matchId, player_id:pid, dabei:d.dabei, note:d.note, kommentar:d.kommentar},{onConflict:'match_id,player_id'});
    if(typeof logActivity==='function') logActivity(pid,'match',field+': '+val,null,null,field,null,String(val));
  });
}

async function renderSpiele(){
  document.getElementById('mainContent').innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.4)"><i class="ti ti-loader-2" style="font-size:32px;display:block;margin-bottom:8px;opacity:.5"></i>Lade Spiele...</div>';
  await loadMatches();
  if(matchView==='detail' && selMatch) renderMatchDetail();
  else renderMatchList();
}

function renderMatchList(){
  var out = '';
  out += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">';
  out += '<button onclick="createMatch()" style="padding:9px 16px;font-size:13px;font-weight:700;background:linear-gradient(135deg,#e07b39,#c25e1f);border:none;border-radius:8px;color:#fff;cursor:pointer;display:flex;align-items:center;gap:6px"><i class="ti ti-plus"></i> Neues Spiel</button>';
  out += '<span style="font-size:11px;color:rgba(255,255,255,0.4)">'+matchesData.length+' Spiele erfasst</span></div>';
  if(matchesData.length===0){
    out += '<div style="text-align:center;padding:50px;color:rgba(255,255,255,0.3)"><i class="ti ti-ball-football" style="font-size:40px;display:block;margin-bottom:10px;opacity:.3"></i>Noch keine Spiele. Klick auf "Neues Spiel".</div>';
    document.getElementById('mainContent').innerHTML = out; return;
  }
  out += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">';
  matchesData.forEach(function(m){
    var t = typInfo(m.typ);
    var aufgebot = matchPlayersData[m.id] || {};
    var dabeiCount = Object.values(aufgebot).filter(function(p){return p.dabei;}).length;
    var hasResult = m.tore_eigen!=null && m.tore_gegner!=null;
    var resultStr = hasResult ? (m.tore_eigen+':'+m.tore_gegner) : '–:–';
    var resultColor = hasResult ? (m.tore_eigen>m.tore_gegner?'#22c55e':m.tore_eigen<m.tore_gegner?'#ef4444':'#f59e0b') : 'rgba(255,255,255,0.3)';
    out += '<div style="background:#111d2e;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:14px;cursor:pointer;position:relative;overflow:hidden" onclick="selMatch=\''+m.id+'\';matchView=\'detail\';renderSpiele()">';
    out += '<div style="position:absolute;top:0;left:0;right:0;height:3px;background:'+t.color+'"></div>';
    out += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="font-size:9px;font-weight:700;color:'+t.color+';background:'+t.color+'22;padding:3px 8px;border-radius:4px">'+t.label.toUpperCase()+'</span>';
    out += '<span style="margin-left:auto;font-size:10px;color:rgba(255,255,255,0.4)">'+(m.datum?new Date(m.datum).toLocaleDateString('de-CH'):'kein Datum')+'</span></div>';
    out += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><div><div style="font-size:14px;font-weight:700;color:#e2e8f0">FE12 vs '+escSp(m.gegner||'?')+'</div>';
    out += '<div style="font-size:10px;color:rgba(255,255,255,0.4)">'+escSp(m.ort||'kein Ort')+'</div></div>';
    out += '<div style="font-size:22px;font-weight:800;color:'+resultColor+'">'+resultStr+'</div></div>';
    out += '<div style="display:flex;align-items:center;gap:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.05)"><i class="ti ti-users" style="font-size:12px;color:rgba(255,255,255,0.4)"></i>';
    out += '<span style="font-size:11px;color:rgba(255,255,255,0.5)">'+dabeiCount+' Spieler im Aufgebot</span>';
    if(m.bericht) out += '<i class="ti ti-file-text" style="margin-left:auto;font-size:12px;color:#22c55e"></i>';
    out += '</div></div>';
  });
  out += '</div>';
  document.getElementById('mainContent').innerHTML = out;
}

function renderMatchDetail(){
  var m = matchesData.find(function(x){return x.id===selMatch;});
  if(!m){ matchView='list'; renderMatchList(); return; }
  var t = typInfo(m.typ);
  var aufgebot = matchPlayersData[m.id] || {};
  var NT = (typeof NOTES!=='undefined') ? NOTES : [1,1.25,1.5,1.75,2,2.25,2.5,2.75,3,3.25,3.5,3.75,4];
  var nc = (typeof noteColor==='function') ? noteColor : function(){return '#e2e8f0';};
  var ini = (typeof initials==='function') ? initials : function(n){return n.substring(0,2).toUpperCase();};

  var out = '';
  out += '<button onclick="matchView=\'list\';selMatch=null;renderSpiele()" style="display:flex;align-items:center;gap:5px;font-size:13px;color:rgba(255,255,255,0.5);background:none;border:none;cursor:pointer;margin-bottom:14px"><i class="ti ti-arrow-left"></i> Zurück zu allen Spielen</button>';
  out += '<div style="background:#111d2e;border:1px solid rgba(255,255,255,0.07);border-left:4px solid '+t.color+';border-radius:0 12px 12px 0;padding:16px 20px;margin-bottom:14px"><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">';
  out += '<div><div style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.4);margin-bottom:4px">SPIELTYP</div><select onchange="saveMatch(\''+m.id+'\',\'typ\',this.value,\''+m.typ+'\');renderSpiele()" style="font-size:13px;padding:7px 10px;background:#1e2a3a;border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:'+t.color+';font-weight:700">';
  SPIEL_TYPEN.forEach(function(st){ out += '<option value="'+st.key+'"'+(m.typ===st.key?' selected':'')+'>'+st.label+'</option>'; });
  out += '</select></div>';
  out += '<div style="flex:1;min-width:140px"><div style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.4);margin-bottom:4px">GEGNER</div><input value="'+escSp(m.gegner||'')+'" oninput="saveMatch(\''+m.id+'\',\'gegner\',this.value,\'\')" placeholder="Gegner..." style="width:100%;font-size:14px;font-weight:700;padding:7px 10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#e2e8f0;box-sizing:border-box"/></div>';
  out += '<div><div style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.4);margin-bottom:4px">DATUM</div><input type="date" value="'+(m.datum||'')+'" onchange="saveMatch(\''+m.id+'\',\'datum\',this.value,\'\')" style="font-size:13px;padding:7px 10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#e2e8f0"/></div>';
  out += '<div style="flex:1;min-width:120px"><div style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.4);margin-bottom:4px">SPIELORT</div><input value="'+escSp(m.ort||'')+'" oninput="saveMatch(\''+m.id+'\',\'ort\',this.value,\'\')" placeholder="Ort..." style="width:100%;font-size:13px;padding:7px 10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#e2e8f0;box-sizing:border-box"/></div>';
  out += '<button onclick="deleteMatch(\''+m.id+'\')" style="padding:8px 10px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:6px;color:#ef4444;cursor:pointer;font-size:12px"><i class="ti ti-trash"></i></button>';
  out += '</div></div>';

  out += '<div style="background:#111d2e;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px;margin-bottom:14px"><div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:.08em;margin-bottom:12px">RESULTAT</div><div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center">';
  out += '<div style="text-align:center"><div style="font-size:9px;color:rgba(255,255,255,0.4);margin-bottom:6px">ENDSTAND</div><div style="display:flex;align-items:center;gap:8px"><span style="font-size:11px;color:#e07b39;font-weight:700">FE12</span>';
  out += '<input type="number" value="'+(m.tore_eigen!=null?m.tore_eigen:'')+'" oninput="saveMatch(\''+m.id+'\',\'tore_eigen\',this.value===\'\'?null:parseInt(this.value),\'\')" style="width:48px;font-size:20px;font-weight:800;text-align:center;padding:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#e2e8f0"/>';
  out += '<span style="font-size:20px;color:rgba(255,255,255,0.3)">:</span>';
  out += '<input type="number" value="'+(m.tore_gegner!=null?m.tore_gegner:'')+'" oninput="saveMatch(\''+m.id+'\',\'tore_gegner\',this.value===\'\'?null:parseInt(this.value),\'\')" style="width:48px;font-size:20px;font-weight:800;text-align:center;padding:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#e2e8f0"/>';
  out += '<span style="font-size:11px;color:rgba(255,255,255,0.4);font-weight:700">Gegner</span></div></div>';
  out += '<div style="text-align:center"><div style="font-size:9px;color:rgba(255,255,255,0.4);margin-bottom:6px">HALBZEIT</div><div style="display:flex;align-items:center;gap:6px">';
  out += '<input type="number" value="'+(m.hz_eigen!=null?m.hz_eigen:'')+'" oninput="saveMatch(\''+m.id+'\',\'hz_eigen\',this.value===\'\'?null:parseInt(this.value),\'\')" style="width:40px;font-size:14px;font-weight:700;text-align:center;padding:5px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:rgba(255,255,255,0.7)"/>';
  out += '<span style="font-size:14px;color:rgba(255,255,255,0.3)">:</span>';
  out += '<input type="number" value="'+(m.hz_gegner!=null?m.hz_gegner:'')+'" oninput="saveMatch(\''+m.id+'\',\'hz_gegner\',this.value===\'\'?null:parseInt(this.value),\'\')" style="width:40px;font-size:14px;font-weight:700;text-align:center;padding:5px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:rgba(255,255,255,0.7)"/></div></div>';
  out += '<div style="flex:1;min-width:180px"><div style="font-size:9px;color:rgba(255,255,255,0.4);margin-bottom:6px">TORSCHÜTZEN</div><input value="'+escSp(m.torschuetzen||'')+'" oninput="saveMatch(\''+m.id+'\',\'torschuetzen\',this.value,\'\')" placeholder="z.B. Morel 2, Kraus 1..." style="width:100%;font-size:13px;padding:7px 10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#e2e8f0;box-sizing:border-box"/></div>';
  out += '</div></div>';

  out += '<div style="background:#111d2e;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px;margin-bottom:14px"><div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:.08em;margin-bottom:10px">SPIELBERICHT</div>';
  out += '<textarea oninput="saveMatch(\''+m.id+'\',\'bericht\',this.value,\'\')" placeholder="Spielverlauf, Beobachtungen, Erkenntnisse..." style="width:100%;min-height:90px;font-size:13px;padding:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#e2e8f0;resize:vertical;box-sizing:border-box;line-height:1.6">'+escSp(m.bericht||'')+'</textarea></div>';

  var dabeiCount = Object.values(aufgebot).filter(function(p){return p.dabei;}).length;
  out += '<div style="background:#111d2e;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:.08em">AUFGEBOT</span>';
  out += '<span style="font-size:11px;color:#22c55e;font-weight:700">'+dabeiCount+' dabei</span><span style="margin-left:auto;font-size:10px;color:rgba(255,255,255,0.3)">Spieler antippen · Note 1–4 · Kommentar</span></div>';
  PLAYERS.forEach(function(p){
    var d = aufgebot[p.id] || {dabei:false, note:null, kommentar:''};
    var dabei = d.dabei;
    out += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);flex-wrap:wrap">';
    out += '<button onclick="toggleMatchPlayer(\''+m.id+'\','+p.id+')" style="width:30px;height:30px;border-radius:8px;border:1px solid '+(dabei?'#22c55e':'rgba(255,255,255,0.1)')+';background:'+(dabei?'rgba(34,197,94,0.15)':'rgba(255,255,255,0.03)')+';color:'+(dabei?'#22c55e':'rgba(255,255,255,0.3)')+';cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center"><i class="ti ti-'+(dabei?'check':'x')+'"></i></button>';
    out += '<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:140px;opacity:'+(dabei?'1':'0.4')+'"><div style="width:26px;height:26px;border-radius:50%;background:rgba(224,123,57,0.15);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#e07b39;flex-shrink:0">'+ini(p.name)+'</div><span style="font-size:13px;font-weight:600;color:#e2e8f0">'+escSp(p.name)+'</span></div>';
    if(dabei){
      out += '<select onchange="setMatchPlayerField(\''+m.id+'\','+p.id+',\'note\',this.value?parseFloat(this.value):null)" style="width:62px;font-size:12px;padding:4px;background:#1e2a3a;border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:'+(d.note?nc(d.note):'#6b7280')+';font-weight:700;text-align:center"><option value="">Note</option>';
      NT.forEach(function(n){ out += '<option value="'+n+'"'+(d.note==n?' selected':'')+'>'+n.toFixed(2)+'</option>'; });
      out += '</select>';
      out += '<input value="'+escSp(d.kommentar||'')+'" oninput="setMatchPlayerField(\''+m.id+'\','+p.id+',\'kommentar\',this.value)" placeholder="Kommentar..." style="flex:2;min-width:140px;font-size:12px;padding:5px 9px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#e2e8f0;box-sizing:border-box"/>';
    }
    out += '</div>';
  });
  out += '</div>';
  document.getElementById('mainContent').innerHTML = out;
}

async function loadDashMatches(){
  var el = document.getElementById('dashMatches');
  if(!el) return;
  if(matchesData.length===0){ await loadMatches(); }
  if(matchesData.length===0) return;
  var recent = matchesData.slice(0,3);
  var out = '<div style="background:#111d2e;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px;margin-bottom:16px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><i class="ti ti-ball-football" style="color:#e07b39;font-size:16px"></i><span style="font-size:13px;font-weight:700;color:#e2e8f0">Letzte Spiele</span>';
  out += '<button onclick="showView(\'spiele\')" style="margin-left:auto;padding:5px 12px;font-size:11px;font-weight:700;background:rgba(224,123,57,0.12);border:1px solid rgba(224,123,57,0.25);border-radius:6px;color:#e07b39;cursor:pointer">Alle Spiele →</button></div><div style="display:flex;gap:10px;flex-wrap:wrap">';
  recent.forEach(function(m){
    var t = typInfo(m.typ);
    var hasResult = m.tore_eigen!=null && m.tore_gegner!=null;
    var resultStr = hasResult ? (m.tore_eigen+':'+m.tore_gegner) : '–:–';
    var resultColor = hasResult ? (m.tore_eigen>m.tore_gegner?'#22c55e':m.tore_eigen<m.tore_gegner?'#ef4444':'#f59e0b') : 'rgba(255,255,255,0.3)';
    out += '<div style="flex:1;min-width:160px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:12px;cursor:pointer" onclick="selMatch=\''+m.id+'\';matchView=\'detail\';showView(\'spiele\')">';
    out += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="font-size:8px;font-weight:700;color:'+t.color+';background:'+t.color+'22;padding:2px 6px;border-radius:3px">'+t.label.toUpperCase()+'</span><span style="margin-left:auto;font-size:9px;color:rgba(255,255,255,0.4)">'+(m.datum?new Date(m.datum).toLocaleDateString('de-CH'):'')+'</span></div>';
    out += '<div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:12px;font-weight:600;color:#e2e8f0">vs '+escSp(m.gegner||'?')+'</span><span style="font-size:16px;font-weight:800;color:'+resultColor+'">'+resultStr+'</span></div></div>';
  });
  out += '</div></div>';
  el.innerHTML = out;
}

// eigene esc-Funktion (falls die aus index.html nicht erreichbar)
function escSp(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
