git clone git@github.com:graphprotocol/graph-node.git
docker rmi graphprotocol/graph-node:latest
cd graph-node && ./docker/build.sh
docker tag graph-node graphprotocol/graph-node:latest