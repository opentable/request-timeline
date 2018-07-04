echo "Discovery wrapping start called ..."
# print out debug info
env
DIR=`pwd`
cd $DIR
echo "Restart nginx"
service nginx restart
echo "Run wrapper"
$DIR/discovery-wrapper -t ot-timeline -s http -w 10 $DIR/sleep.sh
