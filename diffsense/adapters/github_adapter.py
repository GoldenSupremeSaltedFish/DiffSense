import os
from github import Github, GithubException
import requests
from .base import PlatformAdapter

class GitHubAdapter(PlatformAdapter):
    def __init__(self, token: str, repo_name: str, pr_number: int):
        self.gh = Github(token)
        self.repo = self.gh.get_repo(repo_name)
        self.pr = self.repo.get_pull(pr_number)
        self.comment_tag = "<!-- diffsense_audit_report -->"

    def fetch_diff(self) -> str:
        # PyGithub's get_files() doesn't give raw unified diff easily for the whole PR.
        # It's better to fetch the diff url directly.
        # But wait, self.pr.diff_url gives the url, we need to download it.
        # However, accessing the URL requires auth if the repo is private.
        # We can use the token in headers.
        
        headers = {
            'Authorization': f'token {self.gh.get_user().login if False else os.environ.get("GITHUB_TOKEN")}', 
            'Accept': 'application/vnd.github.v3.diff'
        }
        # Actually PyGithub handles auth, but for raw request we need to handle it.
        # Let's use requests.
        # Note: os.environ.get("GITHUB_TOKEN") is usually passed via constructor, 
        # but here we rely on the passed token.
        
        # Re-construct headers properly
        # We need to use the token passed in init. 
        # But wait, Github object doesn't expose raw token easily? 
        # Actually it does, but let's just use the one passed to init.
        # Wait, self.gh is authenticated.
        
        # self.pr.diff_url is public accessible? No, for private repos it needs auth.
        # Let's use requests with the token.
        
        # BUT, there's a simpler way:
        # response = requests.get(self.pr.diff_url, headers={'Authorization': f'token {token}'})
        # I need to store the token.
        pass 
        # Let's refactor init to store token or handle this better.
        # Actually, self.pr has not 'diff' attribute directly?
        # PyGithub requests:
        # content = self.repo._requester.requestJsonAndCheck("GET", self.pr.url, headers={"Accept": "application/vnd.github.v3.diff"})
        # This is internal API usage.
        
        # Safer way: requests.
        pass

    def fetch_diff_safe(self, token: str) -> str:
        headers = {
            'Authorization': f'token {token}',
            'Accept': 'application/vnd.github.v3.diff'
        }
        response = requests.get(self.pr.url, headers=headers)
        response.raise_for_status()
        return response.text

    def post_comment(self, content: str):
        # Check for existing comment
        comments = self.pr.get_issue_comments()
        existing_comment = None
        for comment in comments:
            if self.comment_tag in comment.body:
                existing_comment = comment
                break
        
        body = f"{self.comment_tag}\n{content}"
        
        if existing_comment:
            existing_comment.edit(body)
            print(f"Updated existing comment {existing_comment.id}")
        else:
            self.pr.create_issue_comment(body)
            print("Created new comment")

# Redefine class to include token storage and proper fetch
class GitHubAdapter(PlatformAdapter):
    def __init__(self, token: str, repo_name: str, pr_number: int):
        self.token = token
        self.gh = Github(token)
        self.repo = self.gh.get_repo(repo_name)
        self.pr = self.repo.get_pull(pr_number)
        self.comment_tag = "<!-- diffsense_audit_report -->"

    def fetch_diff(self) -> str:
        headers = {
            'Authorization': f'token {self.token}',
            'Accept': 'application/vnd.github.v3.diff'
        }
        # self.pr.url gives the API url (e.g. https://api.github.com/repos/...)
        # Requesting it with diff header gives the diff.
        response = requests.get(self.pr.url, headers=headers)
        response.raise_for_status()
        return response.text

    def post_comment(self, content: str):
        comments = self.pr.get_issue_comments()
        existing_comment = None
        for comment in comments:
            if self.comment_tag in comment.body:
                existing_comment = comment
                break
        
        final_body = f"{content}\n\n{self.comment_tag}"
        
        if existing_comment:
            existing_comment.edit(final_body)
            print(f"Updated GitHub comment {existing_comment.id}")
        else:
            self.pr.create_issue_comment(final_body)
            print("Created GitHub comment")
