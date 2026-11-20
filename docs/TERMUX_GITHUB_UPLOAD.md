# Push SoundChat to GitHub from Termux — step by step

Goal: get the soundchat-v2 folder from the downloaded zip into your GitHub
repo (account: Brooklyn420, repo referred to as "Soundchat platform") so the
code is saved outside this phone and outside Muse.

You only do this once. Later exports just repeat steps 5-7 (copy the new
files over, commit, push).

## 1. Install the tools

Open Termux and run:

~~~sh
pkg update && pkg install -y git gh unzip
~~~

- git is for version control, gh is GitHub's command-line login + repo tool,
  unzip opens the downloaded zip.

## 2. Let Termux see your Downloads folder

~~~sh
termux-setup-storage
~~~

Android will ask for storage permission — allow it. This creates the
~/storage folder that links to the phone's shared storage.

## 3. Unzip the export

The SoundChat page's "Download for GitHub" button saves
soundchat-v2-source.zip. Browsers usually put it in Downloads:

~~~sh
cd ~/storage/downloads
ls
unzip soundchat-v2-source.zip
cd soundchat-v2
ls
~~~

You should see README.md, package.json, client, server, drizzle, and docs.
If the zip landed somewhere else, find it first:

~~~sh
find ~/storage -name "soundchat-v2-source.zip" 2>/dev/null
~~~

## 4. Turn the folder into a git repo

~~~sh
git init
git add .
git commit -m "SoundChat v2 source"
~~~

If git asks who you are the first time, set it once:

~~~sh
git config --global user.name "Brooklyn420"
git config --global user.email "your-github-email@example.com"
~~~

Use the email tied to your GitHub account, then run the commit again.

## 5. Log in to GitHub

~~~sh
gh auth login
~~~

Pick: GitHub.com -> HTTPS -> Login with a web browser. It shows a one-time
code — copy it, the browser opens GitHub, paste the code, approve. That signs
Termux in as Brooklyn420 without typing your password into the terminal.

## 6a. Create the repo and push (first time, no repo yet)

~~~sh
gh repo create soundchat-platform --private --source=. --remote=origin --push
~~~

- Use --public instead of --private if you want anyone to see it.
- This creates Brooklyn420/soundchat-platform, connects it as origin, and
  pushes your commit in one go. Done — your code is on GitHub.

## 6b. Push into an existing repo instead

If "Soundchat platform" already exists on your account, connect to it and
push (a GitHub repo name cannot contain spaces — on github.com it will be
something like soundchat-platform; check the repo page for its exact URL and
use that URL below):

~~~sh
git remote add origin https://github.com/Brooklyn420/soundchat-platform.git
git branch -M main
git push -u origin main
~~~

If the existing repo already has files and git refuses the push, run
git pull origin main --allow-unrelated-histories once, fix anything it flags,
then push again.

## 7. Check it worked

Open https://github.com/Brooklyn420 in your browser — the soundchat-platform
repo should show the SoundChat files and your "SoundChat v2 source" commit.

## Updating later

Download a fresh export, unzip it over the same folder (or into a new one and
copy the files across), then:

~~~sh
cd soundchat-v2
git add .
git commit -m "SoundChat update"
git push
~~~
