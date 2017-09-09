hlin.co
=======
Personal blog, generated by Jekyll.

Fonts:
https://icomoon.io/app/

Gems:
bourbon
jekyll-assets

Install and upgrade:
====================
# installing fresh jekyll
sudo apt-get install ruby-full
gem install jekyll
gem install bundle

# upgrade site from Jekyll 2.x to 3.x
>> inside site directory
bundle update
bundle update jekyll

>> possibly add redcarpet into Gemfile and install gem


# command to get site specific gems if they are missing
jekyll build 2>&1 | grep "Could not find" | awk -F'Could not find ' '{print $2}' | awk '{print $1}' | sed 's/\(.*\)-/\1 /' | awk '{print "gem install " $1 " -v " $2}' | source  /dev/stdin

On Maintaining
==============

1. hlin.co is built with Jekyll
> jekyll serve -host 0.0.0.0

2. hlin.co is the dynamic code that is served in git@bitbucket.org:henrulin/hlin.co.git
3. The compiled/built hlin.co site code (usually in _site directory when jekyll runs on default settings) is served on https://github.com/henrulin/henrulin.github.io.git
4. Deployment on hlin.co:
    a. On the dynamic codebase, commit change and push into bitbucket repo.
    b. Generate static codebase using Jekyll serve.
    c. On the static codebase, commit and push to gitHub.
5. Automatic post deployment on hlin.co:
    a. Create post on Drafts
    b. (auto) Load to Dropbox which should sync into Uboo via dropboxd
    c. (auto) Rsync Uboo post into local dynamic codebase repo
    d. (auto) Review result with running Jekyll serve
    e. Once okay commit and push any new dynamic code into bitbucket.
    f. goCD on Uboo should detect this change and perform a cleanroom deploy to live site on gitHub.

