import gitlab
import requests
from .base import PlatformAdapter

class GitLabAdapter(PlatformAdapter):
    def __init__(self, url: str, token: str, project_id: str, mr_iid: int):
        self.gl = gitlab.Gitlab(url, private_token=token)
        self.project = self.gl.projects.get(project_id)
        self.mr = self.project.mergerequests.get(mr_iid)
        self.comment_tag = "<!-- diffsense_audit_report -->"
        self.token = token # store for manual request if needed

    def fetch_diff(self) -> str:
        # GitLab python lib doesn't seem to export raw diff easily via .changes() (returns dict)
        # We can use the .diff() method on MR but that returns list of diff dicts.
        # It's better to fetch the .diff endpoint directly to get unified diff.
        # Endpoint: /projects/:id/merge_requests/:merge_request_iid.diff
        
        # Construct URL
        # self.gl.url usually is 'https://gitlab.com' or 'https://gitlab.example.com'
        base_url = self.gl.url.rstrip('/')
        diff_url = f"{base_url}/api/v4/projects/{self.project.id}/merge_requests/{self.mr.iid}.diff"
        
        headers = {
            'PRIVATE-TOKEN': self.token
        }
        
        response = requests.get(diff_url, headers=headers)
        response.raise_for_status()
        return response.text

    def post_comment(self, content: str):
        # Check for existing comment
        notes = self.mr.notes.list(all=True)
        existing_note = None
        for note in notes:
            if self.comment_tag in note.body:
                existing_note = note
                break
        
        final_body = f"{content}\n\n{self.comment_tag}"
        
        if existing_note:
            existing_note.body = final_body
            existing_note.save()
            print(f"Updated GitLab note {existing_note.id}")
        else:
            self.mr.notes.create({'body': final_body})
            print("Created GitLab note")
