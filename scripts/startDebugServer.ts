import TcpSocket from 'react-native-tcp-socket';

let mySecretValue = 'hello-expo';

export function startDebugServer() {
    const server = TcpSocket.createServer(socket => {
        socket.on('data', () => {
            socket.write(
                JSON.stringify({
                    value: mySecretValue,
                    time: Date.now(),
                })
            );
            socket.destroy();
        });
    });

    server.listen({ port: 9090, host: '0.0.0.0' });
}