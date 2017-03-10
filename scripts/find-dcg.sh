unq="sort -k 2"
unq2=uniq
if [ $1 == -u ]; then
    unq="sort -u -k 2"
    unq2=cat
fi
grep dcg_ src/* | sed 's/:.*dcg/ dcg/' | sed 's/\(dcg_[a-zA-Z_]*\).*/\1/' | $unq | $unq2 | awk '{printf("%s\t%s\n", $2, $1)}'

