from abc import ABC, abstractmethod

class PlatformAdapter(ABC):
    @abstractmethod
    def fetch_diff(self) -> str:
        """
        Fetch unified diff content from the platform.
        """
        pass

    @abstractmethod
    def post_comment(self, content: str):
        """
        Post a comment to the MR/PR.
        Should handle update logic if applicable (e.g. edit existing comment).
        """
        pass

    def is_approved(self) -> bool:
        """
        Check if the MR/PR is approved by a reviewer.
        Default implementation returns False.
        """
        return False
