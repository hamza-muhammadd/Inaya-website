(function(){
  const uid=()=>'id'+Math.random().toString(36).slice(2,10);
  const now=new Date().toISOString();
  const DB={
    admin_users:[{user_id:'u1',email:'owner@test.com',role:'owner'}],
    site_settings:[{id:1,data:{academy_name:'Inaya Quran Academy',whatsapp_number:'8801700000000'}}],
    pages:[{slug:'home',title:'Home',status:'published',draft_sections:[],published_sections:[],has_unpublished:false,updated_at:now},{slug:'about',title:'About',status:'published',draft_sections:[],published_sections:[],has_unpublished:false,updated_at:now}],
    page_templates:[],
    translations:[{id:1,lang:'bn',src_hash:'aaaaaaaaaaaaaaaaaaaaaaaaaaaa',source:'Quran Reading for Beginners',text:'[machine] bn',status:'ok',is_override:false,updated_at:now},{id:2,lang:'bn',src_hash:'bbbbbbbbbbbbbbbbbbbbbbbbbbbb',source:'Open day',text:null,status:'failed',is_override:false,updated_at:now}],
    programs:[{id:'p1',slug:'quran-reading-fluency',title:'Quran Reading & Fluency',short_description:'s',description:'d',objectives:['a'],student_profile:'',curriculum_overview:'',cta_label:'Book',image_url:'',sort_order:1,status:'published'},{id:'p2',slug:'two',title:'Two',short_description:'',description:'',objectives:[],student_profile:'',curriculum_overview:'',cta_label:'Book',image_url:'',sort_order:2,status:'draft'}],
    program_levels:[{id:'l1',program_id:'p1',level_number:1,title:'Reading Foundations',description:'',sort_order:1,status:'published'},{id:'l2',program_id:'p1',level_number:2,title:'Connected',description:'',sort_order:2,status:'published'}],
    curriculum_modules:[{id:'m1',level_id:'l1',title:'Letters',description:'x',lessons:[{title:'Alif',description:'first'}],assessment_criteria:'reads',sort_order:1,status:'draft'}],
    faqs:[{id:'f1',category:'General',question:'Q1?',answer:'A1',sort_order:1,published:true,created_at:now}],
    leads:[{id:'ld1',lead_code:'IQA-1001',name:'Amina Khan',student_name:'Yusuf',email:'a@b.co',whatsapp:'+447700900000',age_group:'6–8',country:'UK',program_interest:'Quran Reading & Fluency',goal:'read',reading_level:'Beginner',contact_method:'WhatsApp',preferred_time:'eve',consent:true,source:'facebook',utm_source:'facebook',utm_medium:'social',utm_campaign:'facebook_program_launch',status:'New',internal_notes:'',follow_up_date:'2020-01-01',created_at:now}],
    lead_events:[{id:1,lead_id:'ld1',event_type:'created',to_status:'New',created_at:now}],
    assessments:[],enrollments:[],students:[],attendance:[],fee_plans:[],invoices:[],payments:[],teacher_pay_records:[],teachers:[],class_groups:[],class_slots:[],class_students:[],guardians:[],student_notes:[],student_events:[],contact_messages:[{id:'c1',name:'Zed',email:'z@z.co',message:'hello there',handled:false,created_at:now}],media_assets:[],cta_events:[]
  };
  if(window.__PERSIST){try{const sv=JSON.parse(sessionStorage.getItem('__mockdb')||'null'); if(sv)Object.keys(sv).forEach(k=>{DB[k]=sv[k]});}catch(e){} window.__save=()=>sessionStorage.setItem('__mockdb',JSON.stringify(DB));}
  const REL={
    programs:{program_levels:r=>DB.program_levels.filter(l=>l.program_id===r.id)},
    program_levels:{programs:r=>DB.programs.find(p=>p.id===r.program_id)},
    assessments:{leads:r=>DB.leads.find(l=>l.id===r.lead_id)},
    enrollments:{leads:r=>DB.leads.find(l=>l.id===r.lead_id),programs:r=>DB.programs.find(p=>p.id===r.program_id)||null,program_levels:r=>DB.program_levels.find(p=>p.id===r.level_id)||null},
    lead_events:{leads:r=>DB.leads.find(l=>l.id===r.lead_id)}
  };
  function B(table){
    const st={table,f:[],ord:[],op:'select',single:false,maybe:false,count:false,head:false,sel:'*',rng:null,lim:null};
    const api={
      select(s,o){ if(st.op==='select'||true){st.sel=s||'*';} if(o&&o.count)st.count=true; if(o&&o.head)st.head=true; return api;},
      insert(p){st.op='insert';st.payload=p;return api;},update(p){st.op='update';st.payload=p;return api;},upsert(p,o){st.op='upsert';st.payload=p;st.conf=o&&o.onConflict;return api;},delete(){st.op='delete';return api;},
      eq(c,v){st.f.push(r=>r[c]===v);return api;},in(c,v){st.f.push(r=>v.includes(r[c]));return api;},lte(c,v){st.f.push(r=>r[c]!=null&&r[c]<=v);return api;},gte(c,v){st.f.push(r=>r[c]>=v);return api;},
      not(c,op,v){st.f.push(r=>!String(v).includes('"'+r[c]+'"'));return api;},or(){return api;},lt(c,v){st.f.push(r=>String(r[c]||"")<v);return api;},
      order(c,o){st.ord.push([c,!(o&&o.ascending===false)]);return api;},limit(n){st.lim=n;return api;},range(a,b){st.rng=[a,b];return api;},
      single(){st.single=true;return api;},maybeSingle(){st.maybe=true;return api;},
      then(res,rej){ try{res(run())}catch(e){rej&&rej(e)} }
    };
    function embed(r,sel){ const o={...r}; (sel.match(/(\w+)\(/g)||[]).forEach(m=>{const k=m.slice(0,-1); const rel=REL[table]&&REL[table][k]; if(rel)o[k]=rel(r);}); return o; }
    function run(){
      if(window.__save&&st.op!=='select')setTimeout(window.__save,0);
      let t=DB[table]; if(!t)return{data:null,error:{message:'no table '+table}};
      if(window.__NO007){const NEW=/archived|show_in_nav|nav_label|nav_order|noindex|is_system|draft_meta/; if(table==='page_templates')return{data:null,error:{message:'relation does not exist'}}; if(table==='pages'&&(NEW.test(st.sel||'')||(st.payload&&Object.keys([].concat(st.payload)[0]).some(k=>NEW.test(k)))))return{data:null,error:{message:'column does not exist',code:'42703'}};}
      if(st.op==='insert'){const rows=[].concat(st.payload).map(p=>({id:uid(),created_at:now,...p}));rows.forEach(r=>t.push(r));console.log('[mock] insert',table,JSON.stringify(rows[0]).slice(0,120));return{data:st.single?rows[0]:rows,error:null};}
      if(st.op==='upsert'){const ps=[].concat(st.payload);const ks=st.conf?st.conf.split(','):['id'];ps.forEach(p=>{const i=t.findIndex(r=>ks.every(k=>r[k]===p[k]));if(i>-1)t[i]={...t[i],...p};else t.push({id:uid(),...p});});console.log('[mock] upsert',table,ps.length);return{data:st.payload,error:null};}
      let rows=t.filter(r=>st.f.every(f=>f(r)));
      if(st.op==='update'){rows.forEach(r=>Object.assign(r,st.payload));console.log('[mock] update',table,JSON.stringify(st.payload).slice(0,100));const o=rows.map(r=>({...r}));return{data:st.single?o[0]:o,error:null};}
      if(st.op==='delete'){rows.forEach(r=>t.splice(t.indexOf(r),1));return{data:null,error:null};}
      st.ord.slice().reverse().forEach(([c,asc])=>rows.sort((a,b)=>(a[c]>b[c]?1:a[c]<b[c]?-1:0)*(asc?1:-1)));
      const total=rows.length; if(st.rng)rows=rows.slice(st.rng[0],st.rng[1]+1); if(st.lim)rows=rows.slice(0,st.lim);
      rows=rows.map(r=>embed(r,st.sel));
      if(st.head)return{data:null,count:total,error:null};
      if(st.single){return rows[0]?{data:rows[0],error:null}:{data:null,error:{message:'not found'}};}
      if(st.maybe)return{data:rows[0]||null,error:null};
      return{data:rows,count:st.count?total:null,error:null};
    }
    return api;
  }
  const session={user:{id:'u1',email:'owner@test.com'}};
  window.__DB=DB;
  window.supabase={createClient:()=>({
    from:B,
    rpc:(n,a)=>n==='list_admins'?Promise.resolve({data:DB.admin_users.map(u=>({...u,created_at:now})),error:null}):n==='set_admin_role'?Promise.resolve((()=>{const u=DB.admin_users.find(x=>x.user_id===a.p_user_id);u.role=a.p_role;return{data:null,error:null}})()):n==='remove_admin'?Promise.resolve((()=>{DB.admin_users.splice(DB.admin_users.findIndex(x=>x.user_id===a.p_user_id),1);return{data:null,error:null}})()):n==='add_admin_by_email'?Promise.resolve(a.p_email==='nobody@x.co'?{data:null,error:{message:'No Supabase login exists for that email.'}}:(DB.admin_users.push({user_id:uid(),email:a.p_email,role:a.p_role}),{data:null,error:null})):n==='convert_lead_to_student'?Promise.resolve((()=>{const l=DB.leads.find(x=>x.id===a.p_lead_id);if(l.status!=='Enrollment Confirmed')return{data:null,error:{message:'Only inquiries with status "Enrollment Confirmed" can be converted'}};const id=uid();DB.students.push({id,student_code:'ST-100'+(DB.students.length+1),lead_id:l.id,full_name:l.student_name||l.name,status:'Active',notes:'',created_at:now,deleted_at:null,program_id:null,level_id:null});DB.guardians.push({id:uid(),student_id:id,name:l.name,email:l.email,whatsapp:l.whatsapp,is_primary:true,created_at:now});DB.student_events.push({id:1,student_id:id,event_type:'created',to_status:'Active',note:'Converted from inquiry',created_at:now});return{data:id,error:null};})()):Promise.resolve({data:n==='dashboard_metrics'?{total:1,new:1,contacted:0,assess_sched:0,assess_done:0,followup:0,enroll_pending:0,enroll_confirmed:0,not_proceeding:0}:{events:[{event:'page_view',n:12},{event:'assessment_cta_click',n:4}],campaigns:[{campaign:'facebook_program_launch',source:'facebook',medium:'social',page_views:5,cta_clicks:2,whatsapp_clicks:1,submissions:1,leads:1}]},error:null}),
    auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({}),signInWithPassword:async()=>({data:{session},error:null}),signOut:async()=>({}),updateUser:async()=>({error:null}),resetPasswordForEmail:async()=>({})},
    storage:{from:()=>({upload:async()=>({data:{},error:null}),getPublicUrl:p=>({data:{publicUrl:'https://x.supabase.co/storage/'+p}}),remove:async()=>({error:null})})}
  })};
})();
