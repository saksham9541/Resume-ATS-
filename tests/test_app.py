import os,tempfile,importlib,sys
from pathlib import Path
from fastapi.testclient import TestClient

def test_end_to_end():
    with tempfile.TemporaryDirectory() as d:
        os.environ['DATABASE_PATH']=str(Path(d)/'test.db');os.environ['UPLOAD_DIR']=str(Path(d)/'uploads');os.environ['APP_SECRET']='test-secret-not-for-production'
        sys.path.insert(0,str(Path(__file__).resolve().parents[1])); sys.modules.pop('app',None); import app
        client=TestClient(app.app)
        r=client.post('/api/register',json={'email':'test@example.com','password':'longpassword123'});assert r.status_code==200,r.text
        h={'Authorization':'Bearer '+r.json()['token']}
        assert client.get('/api/me',headers=h).status_code==200
        assert client.get('/api/admin/stats',headers=h).status_code==403
        assert client.post('/api/analyze',headers=h,json={'resume_id':1,'job_description':'Python developer with FastAPI skills'}).status_code==404
        assert client.get('/api/health').json()['status']=='ok'
        from reportlab.pdfgen import canvas
        import io
        b=io.BytesIO();p=canvas.Canvas(b);p.drawString(50,750,'Jane Doe jane@example.com 1234567890');p.drawString(50,730,'Experience Python FastAPI developer Education Skills Projects');p.save()
        up=client.post('/api/resumes',headers=h,files={'file':('cv.pdf',b.getvalue(),'application/pdf')});assert up.status_code==200,up.text
        rid=up.json()['id'];assert client.get(f'/api/resumes/{rid}/download',headers=h).status_code==200
        analysis=client.post('/api/analyze',headers=h,json={'resume_id':rid,'job_description':'Seeking Python FastAPI developer with experience building backend projects'});assert analysis.status_code==200,analysis.text
        assert 0<=analysis.json()['score']<=100
        assert len(client.get('/api/activities',headers=h).json())>=3
        assert client.delete(f'/api/resumes/{rid}',headers=h).status_code==200
        assert client.get(f'/api/resumes/{rid}/download',headers=h).status_code==404
