'use strict';

const { events } = require('brigadier');

events.on('exec', (event, project) => {
  console.log('[EVENT] "exec"');
  console.log('   event: ', event);
  console.log('   project: ', project);
});

events.on('gcr_image_push', (event, project) => {
  const payload = JSON.parse(event.payload);

  /*
    payload: {
      gcrContext: {
        eventId: '78938124563234',
        timestamp: '2018-03-15T21:06:11.814Z',
        eventType: 'google.pubsub.topic.publish',
        resource: {
          service: 'pubsub.googleapis.com',
          name: 'projects/some-gke-project/topics/gcr',
          type: 'type.googleapis.com/google.pubsub.v1.PubsubMessage'
        }
      },
      imageData: {
        "action":"INSERT",
        "digest":"gcr.io/some-gke-project/some-image-named@sha256:some-hash",
        "tag":"gcr.io/some-gke-project/some-image-name:some-tag"
      }
    }
  */

  console.log('[EVENT] "gcr_image_push"');
  console.log('   build ID: ', event.buildID);
  console.log('   worker ID: ', event.workerID);
  console.log('   event type: ', event.type);
  console.log('   event provider: ', event.provider);
  console.log('   event payload GCR context: ', payload.gcrContext);
  console.log('   event payload Image data: ', payload.imageData);
  console.log('   project: ', project);
});

events.on('after', (event, project) => {
  console.log('[EVENT] "after"');
  console.log('   event: ', event);
  console.log('    project: ', project);
});

events.on('error', (event, project) => {
  console.log('[EVENT] "error"');
  console.log('   event: ', event);
  console.log('   project: ', project);
});
