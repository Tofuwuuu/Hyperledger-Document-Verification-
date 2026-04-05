@echo off
REM Setup script for Hyperledger Fabric on Windows

REM Variables
set FABRIC_DIR=%CD%\..\fabric-dev\fabric-samples
set TEST_NET_DIR=%FABRIC_DIR%\test-network
set CC_SRC_PATH=%CD%\..\fabric-network\chaincode\final-smart-contract\javascript
set CC_NAME=final-smart-contract
set CHANNEL_NAME=alumni-channel

echo Setting up Hyperledger Fabric test network...

REM Navigate to test network directory
cd %TEST_NET_DIR%

REM Bring down any existing network
echo Bringing down any existing network...
call network.sh down

REM Start network with CA
echo Starting the test network with Certificate Authorities...
call network.sh up createChannel -ca -c %CHANNEL_NAME%

REM Install chaincode
echo Installing and deploying chaincode...
call network.sh deployCC -ccn %CC_NAME% -ccp %CC_SRC_PATH% -ccl node

REM Generate connection profiles
echo Generating connection profiles...
call organizations\ccp-generate.sh

REM Create backend config directories if they don't exist
set BACKEND_CONFIG_DIR=..\..\..\backend\app\blockchain\config
if not exist %BACKEND_CONFIG_DIR% mkdir %BACKEND_CONFIG_DIR%

REM Copy connection profiles and certificates to backend
echo Copying connection profiles and certificates to backend...
copy organizations\peerOrganizations\org1.example.com\connection-org1.json %BACKEND_CONFIG_DIR%\
copy organizations\peerOrganizations\org1.example.com\connection-org1.yaml %BACKEND_CONFIG_DIR%\

REM Copy certificates
if not exist %BACKEND_CONFIG_DIR%\crypto-config\peerOrganizations\org1.example.com mkdir %BACKEND_CONFIG_DIR%\crypto-config\peerOrganizations\org1.example.com
xcopy /E /I /Y organizations\peerOrganizations\org1.example.com\peers %BACKEND_CONFIG_DIR%\crypto-config\peerOrganizations\org1.example.com\peers
xcopy /E /I /Y organizations\peerOrganizations\org1.example.com\users %BACKEND_CONFIG_DIR%\crypto-config\peerOrganizations\org1.example.com\users
xcopy /E /I /Y organizations\peerOrganizations\org1.example.com\ca %BACKEND_CONFIG_DIR%\crypto-config\peerOrganizations\org1.example.com\ca

REM Update backend .env file
set ENV_FILE=..\..\..\backend\.env

echo # Blockchain configuration > %ENV_FILE%
echo NETWORK_CONFIG_PATH=./app/blockchain/config/connection-org1.yaml >> %ENV_FILE%
echo ORG_NAME=Org1MSP >> %ENV_FILE%
echo ORG_USER=Admin >> %ENV_FILE%
echo CHANNEL_NAME=%CHANNEL_NAME% >> %ENV_FILE%
echo CHAINCODE_NAME=%CC_NAME% >> %ENV_FILE%
echo CONTRACT_NAME=DocumentVerificationContract >> %ENV_FILE%
echo. >> %ENV_FILE%
echo # Path to organization crypto material (relative paths inside the app) >> %ENV_FILE%
echo CRYPTO_PATH=./app/blockchain/config/crypto-config >> %ENV_FILE%

echo Setup complete. Fabric network is running with final-smart-contract chaincode deployed.
echo Backend configuration has been updated.

REM Return to the original directory
cd %~dp0 