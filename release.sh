set -e
[ -n "$DEBUG" ] && set -x

bail() {
    echo $1 >&2
    exit 1
}

VERSION=`node -e "console.log(require('./package.json').version);"`

[ -z "`git tag -l v$VERSION`" ] || bail "Version already published. Skipping publish."
[ "`git rev-parse HEAD`" = "`git rev-parse master`" ] || bail "ERROR: You must release from the master branch."
[ -z "`git status --porcelain`" ] || bail "ERROR: Dirty index on working tree. Use git status to check."

npm publish
git tag v$VERSION
git push origin
git push origin v$VERSION
