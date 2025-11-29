ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions -N ""

cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh

cat ~/.ssh/github_actions