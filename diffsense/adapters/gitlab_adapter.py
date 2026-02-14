import gitlab
import requests
from .base import PlatformAdapter

class GitLabAdapter(PlatformAdapter):
    def __init__(self, url: str, token: str, project_id: str, mr_iid: int):
        self.gl = gitlab.Gitlab(url, private_token=token)
        try:
            self.project = self.gl.projects.get(project_id)
            self.mr = self.project.mergerequests.get(mr_iid)
        except gitlab.exceptions.GitlabGetError as e:
            if e.response_code == 404:
                print(f"❌ Error: Could not find Project {project_id} or MR {mr_iid} on {url}.")
                print("   - Check if DIFFSENSE_TOKEN has 'api' scope.")
                print("   - Ensure the token user is a member of the project.")
                print("   - Verify the GitLab URL is correct (defaults to gitlab.com if not specified).")
            raise e
        self.comment_tag = "<!-- diffsense_audit_report -->"
        self.token = token # store for manual request if needed

    def fetch_diff(self) -> str:
        # GitLab API returns diffs in list of dicts via /changes
        # or we can get unified diff via .diff endpoint.
        # However, for large MRs, the .diff endpoint might be paginated or truncated?
        # Let's try to use the project.mergerequests.changes() method which gives structured diffs
        # and reconstruct unified diff if needed, OR just use the raw diff endpoint.
        
        # Issue: If the raw diff endpoint returns something unexpected or empty.
        # Let's try to use the changes API as a fallback or primary source if raw fails.
        
        base_url = self.gl.url.rstrip('/')
        diff_url = f"{base_url}/api/v4/projects/{self.project.id}/merge_requests/{self.mr.iid}.diff"
        
        headers = {
            'PRIVATE-TOKEN': self.token
        }
        
        try:
            response = requests.get(diff_url, headers=headers)
            response.raise_for_status()
            content = response.text
            if not content.strip():
                 print("Warning: Raw diff is empty. Trying fallback to changes API.")
                 return self._fetch_diff_fallback()
            return content
        except Exception as e:
            print(f"Warning: Failed to fetch raw diff: {e}. Trying fallback.")
            return self._fetch_diff_fallback()

    def _fetch_diff_fallback(self) -> str:
        # Fallback: Use python-gitlab changes() API and reconstruct unified-like diff
        # This is robust because it uses the official API structure
        mr_changes = self.mr.changes()
        diffs = mr_changes.get('changes', [])
        
        unified_diff = []
        for d in diffs:
            old_path = d.get('old_path')
            new_path = d.get('new_path')
            diff_text = d.get('diff', '')
            
            unified_diff.append(f"diff --git a/{old_path} b/{new_path}")
            if d.get('new_file'):
                unified_diff.append(f"--- /dev/null")
                unified_diff.append(f"+++ b/{new_path}")
            elif d.get('deleted_file'):
                unified_diff.append(f"--- a/{old_path}")
                unified_diff.append(f"+++ /dev/null")
            elif d.get('renamed_file'):
                unified_diff.append(f"--- a/{old_path}")
                unified_diff.append(f"+++ b/{new_path}")
            else:
                unified_diff.append(f"--- a/{old_path}")
                unified_diff.append(f"+++ b/{new_path}")
                
            unified_diff.append(diff_text)
            
        return "\n".join(unified_diff)

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

    def is_approved(self) -> bool:
        """
        Check if MR is approved using GitLab's Approvals API.
        """
        try:
            # Need to fetch approvals explicitly
            approvals = self.mr.approvals.get()
            # Logic: If approved_by list is not empty, consider it approved?
            # Or check approvals_left <= 0?
            # Dubbo/OpenSource usually relies on 'approved' state.
            
            # Strategy 1: Check if any approval exists
            if approvals.approved_by and len(approvals.approved_by) > 0:
                return True
                
            # Strategy 2: Check approvals_left (if configured)
            if approvals.approvals_left == 0:
                return True
                
            return False
        except Exception as e:
            print(f"Warning: Failed to fetch GitLab approvals: {e}")
            return False

    def has_ack_reaction(self) -> bool:
        """
        Check if the bot's report comment has a 'thumbsup' or 'rocket' reaction.
        This allows 'Click-to-Ack' flow without formal approval.
        """
        try:
            notes = self.mr.notes.list(all=True)
            target_note = None
            for note in notes:
                if self.comment_tag in note.body:
                    target_note = note
                    break
            
            if not target_note:
                return False
                
            # Fetch award emojis for this note
            # python-gitlab note object usually has 'awardemojis' manager?
            # Or we need to fetch specifically.
            
            # Try efficient way first
            # The list() might not include award_emoji info directly.
            
            # Using specific API call for the note
            # endpoint: GET /projects/:id/merge_requests/:mr_iid/notes/:note_id/award_emoji
            
            # Note: python-gitlab objects are lazy. accessing .awardemojis might work if supported.
            # Let's try standard way
            
            awards = target_note.awardemojis.list()
            for award in awards:
                if award.name in ['thumbsup', 'rocket', '+1']:
                    return True
            
            return False
            
        except Exception as e:
            print(f"Warning: Failed to check reaction: {e}")
            return False
