package dev.rossi.orders.order;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

@Component
public class OrderEventPublisher {

    private final ObjectMapper objectMapper;

    public OrderEventPublisher(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String toJson(OrderCreatedEvent event) {
        try {
            return objectMapper.writeValueAsString(event);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Falha ao serializar o evento", e);
        }
    }
}
