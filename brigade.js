'use strict';

const { events, Job, Group } = require('brigadier');

const _hubCredentials = secrets => `
cat << EOF > $HOME/.config/hub
github.com:
  - protocol: https
    user: ${secrets.GITHUB_USERNAME}
    oauth_token: ${secrets.GITHUB_TOKEN}
EOF
`;

const _hubConfig = (email, name) => `
hub config --global credential.https://github.com.helper /usr/local/bin/hub-credential-helper
hub config --global hub.protocol https
hub config --global user.email "${email}"
hub config --global user.name "${name}"
`;

const _commitImage = (image, buildID) => `
cd src

cat << EOF > patch.yaml
spec:
  template:
    spec:
      containers:
        - name: gitops-hello-world-brigade
          image: ${image}
EOF

kubectl patch --local -o yaml \
  -f kubernetes/deployment.yaml \
  -p "$(cat patch.yaml)" \
  > deployment.yaml

mv deployment.yaml kubernetes/deployment.yaml

hub add kubernetes/deployment.yaml

hub commit -F- << EOF
Update hello world REST API

This commit updates the deployment container image to:
  ${image}

Build ID:
  ${buildID}
EOF
`;

const _pushCommit = cloneURL => `
hub remote add origin ${cloneURL}

hub push origin master
`;

events.on('exec', (brigadeEvent, project) => {
  console.log('[EVENT] "exec" - build ID: ', brigadeEvent.buildID);
});

events.on('gcr_image_push', (brigadeEvent, project) => {
  console.log('[EVENT] "gcr_image_push" - build ID: ', brigadeEvent.buildID);

  const payload = JSON.parse(brigadeEvent.payload);
  const imageAction = payload.imageData.action; // "INSERT" or "DELETE"
  const image = payload.imageData.tag;

  console.log('image action: ', imageAction);
  console.log('image: ', image);

  const infra = new Job('update-infra-config');

  infra.storage.enabled = false;
  infra.image = 'gcr.io/hightowerlabs/hub';
  infra.tasks = [
    _hubCredentials(project.secrets),
    _hubConfig('gitops-bot@crowdynews.com', 'GitOps Bot'),
    _commitImage(image, brigadeEvent.buildID),
    _pushCommit(project.repo.cloneURL)
  ];

  const deploy = new Job('deploy-to-staging');

  deploy.storage.enabled = false;
  deploy.image = 'gcr.io/cloud-builders/kubectl';
  deploy.tasks = ['cd src', 'kubectl apply --recursive -f kubernetes'];

  const pipeline = new Group();

  pipeline.add(infra);
  pipeline.add(deploy);

  pipeline.runEach();
});

events.on('after', (brigadeEvent, project) => {
  console.log('[EVENT] "after" - job done');

  const buildID = brigadeEvent.buildID;
  const kashti = `${project.secrets.KASHTI_URL}/#!/build/${buildID}`;
  const projectName = project.name;
  const slack = new Job('slack-notify');

  http: slack.storage.enabled = false;
  slack.image = 'technosophos/slack-notify';
  slack.tasks = ['/slack-notify'];
  slack.env = {
    SLACK_WEBHOOK: project.secrets.SLACK_WEBHOOK,
    SLACK_TITLE: 'Deployed to staging!',
    SLACK_MESSAGE: `Brigade build <${kashti}|${buildID}>.\n<${projectName}|${projectName}> deployed.`,
    SLACK_COLOR: 'good'
  };

  slack.run();
});

events.on('error', (brigadeEvent, project) => {
  console.log('[EVENT] "error" - payload: ', brigadeEvent.payload);
});
