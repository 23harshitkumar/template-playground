/**
 * serviceAgreement.ts — "Service Agreement Multi-State" sample with TypeScript logic
 *
 * Demonstrates a state machine pattern (PENDING -> APPROVED -> COMPLETED),
 * preventing invalid transitions, and emitting events on state changes.
 */

export const NAME = 'Service Agreement (Multi-State Logic)';

export const MODEL = `namespace org.acme.service@1.0.0

@template
concept ServiceAgreement {
  o String client
  o String provider
  o String serviceDescription
  o Double fee
}

enum ServiceStatus {
  o PENDING
  o APPROVED
  o COMPLETED
}

transaction ApproveRequest {
  o String approverName
}

transaction CompleteRequest {
  o String completionNotes
}

transaction ServiceResponse {
  o ServiceStatus newStatus
  o String message
}

event StatusChangedEvent {
  o ServiceStatus oldStatus
  o ServiceStatus newStatus
  o String message
}

asset ServiceState identified by stateId {
  o String stateId
  o ServiceStatus status
}
`;

export const TEMPLATE = `# Service Agreement
----
This Agreement is between **{{client}}** (the "Client") and **{{provider}}** (the "Provider").

The Provider agrees to perform the following services: 
*{{serviceDescription}}*

Upon completion, the Client agrees to pay the fee of $**{{fee}}**.`;

export const DATA = {
  $class: 'org.acme.service@1.0.0.ServiceAgreement',
  client: 'Acme Corp',
  provider: 'Tech Solutions LLC',
  serviceDescription: 'Web Application Development',
  fee: 5000.00
};

export const REQUEST = {
  $class: 'org.acme.service@1.0.0.ApproveRequest',
  approverName: 'Alice Smith'
};

export const LOGIC = `// Service Agreement Logic
// Demonstrates: State machine pattern (PENDING -> APPROVED -> COMPLETED)
// Validates transitions and throws errors on invalid flows.

class ServiceLogic extends TemplateLogic<any> {

  // Initialize the contract state
  async init(data: any) {
    return {
      state: {
        $class: 'org.acme.service@1.0.0.ServiceState',
        stateId: 'service-state',
        $identifier: 'service-state',
        status: 'PENDING',
      },
      events: []
    };
  }

  // Trigger state transitions based on the request type
  async trigger(data: any, request: any, state: any) {
    const currentStatus = state.status;
    const requestType = request.$class.split('.').pop();
    
    let newStatus = currentStatus;
    let eventMessage = '';

    // State Machine Pattern
    switch (requestType) {
      case 'ApproveRequest':
        if (currentStatus !== 'PENDING') {
          throw new Error(\`Invalid state transition: Cannot approve a service that is currently \${currentStatus}. It must be PENDING.\`);
        }
        newStatus = 'APPROVED';
        eventMessage = \`Service approved by \${request.approverName}\`;
        break;
        
      case 'CompleteRequest':
        if (currentStatus !== 'APPROVED') {
          throw new Error(\`Invalid state transition: Cannot complete a service that is currently \${currentStatus}. It must be APPROVED first.\`);
        }
        newStatus = 'COMPLETED';
        eventMessage = \`Service completed with notes: \${request.completionNotes}\`;
        break;
        
      default:
        throw new Error(\`Unknown request type: \${requestType}\`);
    }

    return {
      result: {
        $class: 'org.acme.service@1.0.0.ServiceResponse',
        $timestamp: new Date(),
        newStatus: newStatus,
        message: eventMessage
      },
      events: [{
        $class: 'org.acme.service@1.0.0.StatusChangedEvent',
        $timestamp: new Date(),
        oldStatus: currentStatus,
        newStatus: newStatus,
        message: eventMessage
      }],
      state: {
        $class: 'org.acme.service@1.0.0.ServiceState',
        stateId: state.stateId,
        $identifier: state.stateId,
        status: newStatus,
      }
    };
  }
}
`;
