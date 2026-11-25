import { useEffect, useState } from "react";
import { staffRequest } from "../../services/staffApi";

export default function StaffFeedback() {
  const [rows,setRows]=useState([]);
  const [form,setForm]=useState({category:"Meal distribution",subject:"",description:""});
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const load=()=>staffRequest("/api/staff/feedback").then((data)=>setRows(data.feedback||[])).catch((err)=>setError(err.message));
  useEffect(()=>{
    const timer=window.setTimeout(()=>void load(),0);
    return ()=>window.clearTimeout(timer);
  },[]);
  const submit=async(e)=>{
    e.preventDefault();setError("");setNotice("");
    try{await staffRequest("/api/staff/feedback",{method:"POST",body:JSON.stringify(form)});setNotice("Feedback submitted successfully.");setForm({category:"Meal distribution",subject:"",description:""});load();}catch(err){setError(err.message);}
  };
  return (
    <main style={{padding:24,maxWidth:900}}>
      <h1>Feedback</h1>
      {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
      <form onSubmit={submit} style={{display:"grid",gap:12,background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:18,marginBottom:20}}>
        <label>Category<select value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})}><option>Meal distribution</option><option>Food quality</option><option>Student attendance</option><option>QR scanner</option><option>Mess management</option><option>Other</option></select></label>
        <label>Subject<input required maxLength={200} value={form.subject} onChange={(e)=>setForm({...form,subject:e.target.value})}/></label>
        <label>Description<textarea required maxLength={5000} value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></label>
        <button type="submit" style={{justifySelf:"start",padding:"10px 16px"}}>Submit Feedback</button>
      </form>
      <div style={{display:"grid",gap:10}}>{rows.map((row)=><article key={row.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:14}}><strong>{row.subject}</strong><p>{row.description}</p><small>Status: {row.status}{row.managerReply?` · Reply: ${row.managerReply}`:""}</small></article>)}</div>
      {!rows.length&&<p>No feedback submissions found.</p>}
    </main>
  );
}
